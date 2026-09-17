import { TRPCError } from "@trpc/server";
import type {
  PrismaClient,
  OdaTransfer,
  OdaTransferOperation,
  OdaTransferStage,
} from "@planeatrepeat/db";
import { rememberShoppingItems } from "../recent-shopping-items";
import { cartSchema, odaTool, type Cart } from "./provider";
import { matchRequirements, snapshotSchema } from "./matching";

// Longer than an individual provider call. Recovery takes ownership under the
// Household lock; the previous request must check ownership before each write.
const leaseDuration = 180_000;
function uncertainMessage(
  transfer: OdaTransfer & { operations: OdaTransferOperation[] },
) {
  const requirements = snapshotSchema.parse(transfer.snapshot);
  const additions = transfer.operations
    .filter((operation) => operation.state === "WRITING")
    .map((operation) => {
      const names = requirements
        .filter((item) => operation.requirementIds.includes(item.id))
        .map((item) => {
          const amount = [item.amount, item.unit]
            .filter((value) => value !== null)
            .join(" ");
          return `${item.name}${item.note ? `, ${item.note}` : ""}${amount ? ` (${amount})` : ""}`;
        });
      return `${operation.quantity} added ${operation.quantity === 1 ? "pack" : "packs"} for ${names.join(", ")}`;
    });
  return additions.length
    ? `Could not verify ${additions.join("; ")}. Check the Oda cart before marking the outcome.`
    : "Cart additions are recorded. Recover the transfer to finish updating your list.";
}

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
    include: { operations: true },
  });
  if (!transfer) return null;
  const status = transferStatus(transfer);
  const operations = new Map(
    transfer.operations.flatMap((operation) =>
      operation.requirementIds.map((id) => [id, operation] as const),
    ),
  );
  return {
    ...status,
    stage: transfer.stage,
    startedAt: transfer.createdAt,
    finishedAt: transfer.state === "COMPLETED" ? transfer.updatedAt : null,
    confirmedProducts: transfer.operations.filter(
      (operation) => operation.quantity > 0 && operation.state === "CONFIRMED",
    ).length,
    totalProducts: transfer.operations.filter(
      (operation) => operation.quantity > 0,
    ).length,
    items: snapshotSchema.parse(transfer.snapshot).map((item) => {
      const operation = operations.get(item.id);
      const state =
        operation?.state === "CONFIRMED"
          ? "CONFIRMED"
          : operation?.state === "WRITING"
            ? status.recoverable || transfer.state === "UNCERTAIN"
              ? "UNCERTAIN"
              : "ADDING"
            : operation?.state === "FAILED" || transfer.state === "COMPLETED"
              ? "UNRESOLVED"
              : operation?.state === "PENDING"
                ? "READY"
                : transfer.state !== "MATCHING"
                  ? "UNRESOLVED"
                  : transfer.stage === "CHECKING_CART"
                    ? "WAITING"
                    : "MATCHING";
      return { id: item.id, name: item.name, state } as const;
    }),
  };
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
          ? uncertainMessage(transfer)
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
  const reportStage = async (stage: OdaTransferStage) => {
    const updated = await db.odaTransfer.updateMany({
      where: { id, householdId, runId },
      data: { stage, leaseUntil: new Date(Date.now() + leaseDuration) },
    });
    if (!updated.count) throw new Error("Transfer ownership changed");
  };
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
      await reportStage("CHECKING_CART");
      const cart = cartSchema.parse(
        await odaTool(db, householdId, "get_cart", {}, transfer.connectionId),
      );
      const operations = await matchRequirements(
        db,
        householdId,
        snapshotSchema.parse(transfer.snapshot),
        cart,
        reportStage,
      );
      const planned = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${householdId} FOR UPDATE`;
        const owned = await tx.odaTransfer.findUniqueOrThrow({ where: { id } });
        if (owned.runId !== runId) return false;
        await tx.odaTransfer.update({
          where: { id },
          data: {
            state: "SENDING",
            stage: "ADDING_TO_CART",
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

    await reportStage("ADDING_TO_CART");
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
        // Keep the member's cart-review decision about one uncertain addition.
        // A recovery must not start another delta while an earlier one is unknown.
        if (
          await tx.odaTransferOperation.count({
            where: { transferId: id, state: "WRITING" },
          })
        )
          return false;
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
    await reportStage("UPDATING_LIST");
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
              ? uncertainMessage(transfer)
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

// The member has checked the cart. This records their decision without making
// another Oda write; later edits still pass through normal revision checks.
export async function resolveUncertain(
  db: PrismaClient,
  householdId: string,
  userId: string,
  id: string,
  outcome: "ADDED" | "NOT_ADDED",
) {
  const runId = crypto.randomUUID();
  const start = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${householdId} FOR UPDATE`;
    const transfer = await tx.odaTransfer.findUniqueOrThrow({
      where: { id, householdId },
    });
    if (transfer.state === "COMPLETED") return { transfer, claimed: false };
    if (transfer.state !== "UNCERTAIN" || !transferStatus(transfer).recoverable)
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Recover the transfer before resolving its outcome.",
      });
    const resolution = transfer.resolution ?? outcome;
    await tx.odaTransferOperation.updateMany({
      where: { transferId: id, state: "WRITING" },
      data: { state: resolution === "ADDED" ? "CONFIRMED" : "FAILED" },
    });
    await tx.odaTransferOperation.updateMany({
      where: { transferId: id, state: "PENDING" },
      data: { state: "FAILED" },
    });
    return {
      transfer: await tx.odaTransfer.update({
        where: { id },
        data: {
          resolution,
          stage: "UPDATING_LIST",
          resolvedByUserId: transfer.resolvedByUserId ?? userId,
          runId,
          leaseUntil: new Date(Date.now() + leaseDuration),
        },
      }),
      claimed: true,
    };
  });
  if (!start.claimed) return transferStatus(start.transfer);
  try {
    return transferStatus(await completeConfirmed(db, householdId, id, runId));
  } catch (error) {
    await db.odaTransfer.updateMany({
      where: { id, householdId, runId },
      data: { runId: null, leaseUntil: null },
    });
    throw error;
  }
}
