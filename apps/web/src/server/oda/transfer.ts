import { TRPCError } from "@trpc/server";
import type { PrismaClient, OdaTransfer } from "@planeatrepeat/db";
import { rememberShoppingItems } from "../recent-shopping-items";
import { cartSchema, odaTool, type Cart } from "./provider";
import { matchRequirements, snapshotSchema } from "./matching";

// Longer than an individual provider call. Recovery takes ownership under the
// Household lock; the previous request must check ownership before each write.
const leaseDuration = 180_000;
const uncertainMessage =
  "Some additions could not be verified. Review the Oda cart; sending is paused to prevent duplicates.";

function transferStatus(transfer: OdaTransfer) {
  return {
    id: transfer.id,
    state: transfer.state,
    cartUrl: transfer.cartUrl,
    message: transfer.message,
    recoverable:
      transfer.state !== "COMPLETED" &&
      (!transfer.leaseUntil || transfer.leaseUntil.getTime() <= Date.now()),
  };
}
export async function currentTransfer(db: PrismaClient, householdId: string) {
  const transfer = await db.odaTransfer.findFirst({
    where: { householdId },
    orderBy: { createdAt: "desc" },
  });
  return transfer ? transferStatus(transfer) : null;
}
function cartQuantity(cart: Cart, productId: number) {
  return cart.groups
    .flatMap((group) => group.items)
    .filter((line) => line.product.id === productId)
    .reduce((sum, line) => sum + line.quantity, 0);
}

async function completeConfirmed(
  db: PrismaClient,
  householdId: string,
  id: string,
  runId: string,
) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${householdId} FOR UPDATE`;
    const transfer = await tx.odaTransfer.findUniqueOrThrow({
      where: { id, householdId },
      include: { operations: true },
    });
    if (transfer.runId !== runId) return transfer;
    const requirements = snapshotSchema.parse(transfer.snapshot);
    const completedIds = new Set(
      transfer.operations
        .filter((operation) => operation.state === "CONFIRMED")
        .flatMap((operation) => operation.requirementIds),
    );
    const snapshot = requirements.filter((item) => completedIds.has(item.id));
    const unchanged = snapshot.length
      ? await tx.shoppingItem.findMany({
          where: {
            householdId,
            OR: snapshot.map(({ id, revision, ownItemId }) => ({
              id,
              revision,
              ownItemId,
            })),
          },
          orderBy: [
            { ownItem: { normalizedName: "asc" } },
            { ownItem: { normalizedNote: "asc" } },
            { id: "asc" },
          ],
        })
      : [];
    await rememberShoppingItems(tx, householdId, unchanged);
    await tx.shoppingItem.deleteMany({
      where: { householdId, id: { in: unchanged.map((item) => item.id) } },
    });
    const uncertain = transfer.operations.some(
      (operation) => operation.state === "WRITING",
    );
    return tx.odaTransfer.update({
      where: { id },
      data: {
        state: uncertain ? "UNCERTAIN" : "COMPLETED",
        runId: null,
        leaseUntil: null,
        message: uncertain
          ? uncertainMessage
          : completedIds.size < requirements.length
            ? "Some items could not be sent. They remain on your list."
            : null,
      },
    });
  });
}

async function runTransfer(
  db: PrismaClient,
  householdId: string,
  id: string,
  runId: string,
) {
  try {
    let transfer = await db.odaTransfer.findUniqueOrThrow({
      where: { id, householdId },
      include: { operations: true },
    });
    const connection = await db.odaConnection.findUnique({
      where: { householdId },
    });
    const sameConnection = connection?.connectionId === transfer.connectionId;
    if (transfer.state === "MATCHING") {
      if (!sameConnection) throw new Error("Connection changed");
      const cart = cartSchema.parse(
        await odaTool(db, householdId, "get_cart", {}, transfer.connectionId),
      );
      const operations = await matchRequirements(
        db,
        householdId,
        snapshotSchema.parse(transfer.snapshot),
        cart,
      );
      const planned = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${householdId} FOR UPDATE`;
        const owned = await tx.odaTransfer.findUniqueOrThrow({ where: { id } });
        if (owned.runId !== runId) return false;
        await tx.odaTransfer.update({
          where: { id },
          data: {
            state: "SENDING",
            cartUrl: cart.url,
            leaseUntil: new Date(Date.now() + leaseDuration),
            operations: {
              create: operations.map((operation) => ({
                ...operation,
                state: operation.quantity === 0 ? "CONFIRMED" : "PENDING",
              })),
            },
          },
        });
        return true;
      });
      if (!planned)
        return transferStatus(
          await db.odaTransfer.findUniqueOrThrow({ where: { id } }),
        );
      transfer = await db.odaTransfer.findUniqueOrThrow({
        where: { id },
        include: { operations: true },
      });
    }

    // A later cart read cannot attribute an explicit delta to this request.
    // Unspecified demand is different: current presence establishes coverage.
    const uncertain = transfer.operations.filter(
      (operation) =>
        operation.state === "WRITING" &&
        operation.unspecifiedRequirementIds.length > 0,
    );
    if (sameConnection && uncertain.length) {
      try {
        const cart = cartSchema.parse(
          await odaTool(db, householdId, "get_cart", {}, transfer.connectionId),
        );
        await db.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${householdId} FOR UPDATE`;
          const owned = await tx.odaTransfer.findUniqueOrThrow({
            where: { id },
          });
          const current = await tx.odaConnection.findUnique({
            where: { householdId },
          });
          if (
            owned.runId !== runId ||
            current?.connectionId !== owned.connectionId
          )
            return;
          for (const operation of uncertain) {
            if (cartQuantity(cart, operation.productId) <= 0) continue;
            const current = await tx.odaTransferOperation.findUniqueOrThrow({
              where: { id: operation.id },
            });
            if (current.state !== "WRITING") continue;
            const covered = current.unspecifiedRequirementIds;
            const remaining = current.requirementIds.filter(
              (id) => !covered.includes(id),
            );
            if (!remaining.length) {
              await tx.odaTransferOperation.update({
                where: { id: current.id },
                data: { state: "CONFIRMED" },
              });
            } else {
              await tx.odaTransferOperation.update({
                where: { id: current.id },
                data: {
                  requirementIds: remaining,
                  unspecifiedRequirementIds: [],
                },
              });
              await tx.odaTransferOperation.create({
                data: {
                  transferId: id,
                  productId: current.productId,
                  quantity: 0,
                  beforeQuantity: cartQuantity(cart, current.productId),
                  requirementIds: covered,
                  unspecifiedRequirementIds: covered,
                  state: "CONFIRMED",
                },
              });
            }
          }
        });
      } catch {
        /* Confirmed parts can still finish when Oda is unreachable. */
      }
    }

    for (const operation of transfer.operations.filter(
      (operation) => operation.state === "PENDING",
    )) {
      const claimed = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${householdId} FOR UPDATE`;
        const owned = await tx.odaTransfer.findUniqueOrThrow({ where: { id } });
        if (owned.runId !== runId) return false;
        const current = await tx.odaConnection.findUnique({
          where: { householdId },
        });
        if (current?.connectionId !== owned.connectionId) return false;
        await tx.odaTransfer.update({
          where: { id },
          data: { leaseUntil: new Date(Date.now() + leaseDuration) },
        });
        return (
          (
            await tx.odaTransferOperation.updateMany({
              where: { id: operation.id, state: "PENDING" },
              data: { state: "WRITING" },
            })
          ).count === 1
        );
      });
      if (!claimed) break;
      try {
        const updated = cartSchema.parse(
          await odaTool(
            db,
            householdId,
            "manipulate_cart",
            {
              operations: [
                {
                  productId: operation.productId,
                  quantity: operation.quantity,
                },
              ],
            },
            transfer.connectionId,
          ),
        );
        if (
          cartQuantity(updated, operation.productId) <
          operation.beforeQuantity + operation.quantity
        )
          break;
        // A late successful response is still evidence, even if another request
        // now owns recovery. It must never initiate another cart operation.
        await db.odaTransferOperation.updateMany({
          where: { id: operation.id, state: "WRITING" },
          data: { state: "CONFIRMED" },
        });
      } catch {
        break;
      }
    }
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${householdId} FOR UPDATE`;
      const owned = await tx.odaTransfer.findUniqueOrThrow({ where: { id } });
      if (owned.runId === runId)
        await tx.odaTransferOperation.updateMany({
          where: { transferId: id, state: "PENDING" },
          data: { state: "FAILED" },
        });
    });
    return transferStatus(await completeConfirmed(db, householdId, id, runId));
  } catch {
    return db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${householdId} FOR UPDATE`;
      const transfer = await tx.odaTransfer.findUniqueOrThrow({
        where: { id },
        include: { operations: true },
      });
      if (transfer.runId !== runId) return transferStatus(transfer);
      const hasRemoteOutcome = transfer.operations.some(
        (operation) =>
          operation.state === "WRITING" || operation.state === "CONFIRMED",
      );
      return transferStatus(
        await tx.odaTransfer.update({
          where: { id },
          data: {
            state: hasRemoteOutcome ? "UNCERTAIN" : "COMPLETED",
            runId: null,
            leaseUntil: null,
            message: hasRemoteOutcome
              ? uncertainMessage
              : "Could not send to Oda. Your items are still on the list. Try again.",
          },
        }),
      );
    });
  }
}

export async function send(db: PrismaClient, householdId: string, id: string) {
  const runId = crypto.randomUUID();
  const start = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${householdId} FOR UPDATE`;
    const previous = await tx.odaTransfer.findUnique({ where: { id } });
    if (previous) {
      if (previous.householdId !== householdId)
        throw new TRPCError({ code: "NOT_FOUND" });
      return { transfer: previous, claimed: false };
    }
    const active = await tx.odaTransfer.findFirst({
      where: { householdId, state: { not: "COMPLETED" } },
    });
    if (active) return { transfer: active, claimed: false };
    const connection = await tx.odaConnection.findUnique({
      where: { householdId },
    });
    if (!connection || connection.reconnectRequired)
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Connect Oda in Shopping List settings.",
      });
    const items = await tx.shoppingItem.findMany({
      where: { householdId },
      include: { ownItem: true },
      orderBy: { id: "asc" },
    });
    if (!items.length)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Your shopping list is empty.",
      });
    const snapshot = items.map((item) => ({
      id: item.id,
      revision: item.revision,
      ownItemId: item.ownItemId,
      amount: item.amount,
      unit: item.unit,
      name: item.ownItem.name,
      note: item.ownItem.note,
    }));
    return {
      transfer: await tx.odaTransfer.create({
        data: {
          id,
          householdId,
          connectionId: connection.connectionId,
          snapshot,
          runId,
          leaseUntil: new Date(Date.now() + leaseDuration),
        },
      }),
      claimed: true,
    };
  });
  return start.claimed
    ? runTransfer(db, householdId, id, runId)
    : transferStatus(start.transfer);
}

export async function recover(
  db: PrismaClient,
  householdId: string,
  id: string,
) {
  const runId = crypto.randomUUID();
  const start = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${householdId} FOR UPDATE`;
    const transfer = await tx.odaTransfer.findUniqueOrThrow({
      where: { id, householdId },
    });
    if (!transferStatus(transfer).recoverable)
      return { transfer, claimed: false };
    return {
      transfer: await tx.odaTransfer.update({
        where: { id },
        data: {
          runId,
          leaseUntil: new Date(Date.now() + leaseDuration),
          state: transfer.state === "MATCHING" ? "MATCHING" : "SENDING",
        },
      }),
      claimed: true,
    };
  });
  return start.claimed
    ? runTransfer(db, householdId, id, runId)
    : transferStatus(start.transfer);
}
