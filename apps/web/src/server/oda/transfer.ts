import { TRPCError } from "@trpc/server";
import type { PrismaClient, OdaTransfer } from "@planeatrepeat/db";
import { rememberShoppingItems } from "../recent-shopping-items";
import { cartSchema, odaTool } from "./provider";
import { matchRequirements, snapshotSchema } from "./matching";

function transferStatus(transfer: OdaTransfer) {
  return {
    id: transfer.id,
    state: transfer.state,
    cartUrl: transfer.cartUrl,
    message: transfer.message,
  };
}
export async function currentTransfer(db: PrismaClient, householdId: string) {
  const transfer = await db.odaTransfer.findFirst({
    where: { householdId },
    orderBy: { createdAt: "desc" },
  });
  return transfer ? transferStatus(transfer) : null;
}

async function completeConfirmed(
  db: PrismaClient,
  householdId: string,
  id: string,
) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${householdId} FOR UPDATE`;
    const transfer = await tx.odaTransfer.findUniqueOrThrow({
      where: { id, householdId },
      include: { operations: true },
    });
    const completedIds = new Set(
      transfer.operations
        .filter((operation) => operation.state === "CONFIRMED")
        .flatMap((operation) => operation.requirementIds),
    );
    const snapshot = snapshotSchema
      .parse(transfer.snapshot)
      .filter((item) => completedIds.has(item.id));
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
        })
      : [];
    await rememberShoppingItems(tx, householdId, unchanged);
    await tx.shoppingItem.deleteMany({
      where: { householdId, id: { in: unchanged.map((item) => item.id) } },
    });
    const uncertain = transfer.operations.some(
      (operation) => operation.state === "WRITING",
    );
    const unresolved =
      completedIds.size < snapshotSchema.parse(transfer.snapshot).length;
    return tx.odaTransfer.update({
      where: { id },
      data: {
        state: uncertain ? "UNCERTAIN" : "COMPLETED",
        message: uncertain
          ? "Oda may have received some items. Check the Oda cart before sending again."
          : unresolved
            ? "Some items could not be sent. They remain on your list."
            : null,
      },
    });
  });
}

export async function send(db: PrismaClient, householdId: string, id: string) {
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
        },
      }),
      claimed: true,
    };
  });
  if (!start.claimed) return transferStatus(start.transfer);
  try {
    const cart = cartSchema.parse(await odaTool(db, householdId, "get_cart"));
    const operations = await matchRequirements(
      db,
      householdId,
      snapshotSchema.parse(start.transfer.snapshot),
      cart,
    );
    await db.odaTransfer.update({
      where: { id },
      data: {
        state: "SENDING",
        cartUrl: cart.url,
        operations: {
          create: operations.map((operation) => ({
            ...operation,
            state: operation.quantity === 0 ? "CONFIRMED" : "PENDING",
          })),
        },
      },
    });
    const pending = await db.odaTransferOperation.findMany({
      where: { transferId: id, state: "PENDING" },
      orderBy: { id: "asc" },
    });
    for (const operation of pending) {
      await db.odaTransferOperation.update({
        where: { id: operation.id },
        data: { state: "WRITING" },
      });
      try {
        const updated = cartSchema.parse(
          await odaTool(db, householdId, "manipulate_cart", {
            operations: [
              { productId: operation.productId, quantity: operation.quantity },
            ],
          }),
        );
        const quantity = updated.groups
          .flatMap((group) => group.items)
          .filter((line) => line.product.id === operation.productId)
          .reduce((sum, line) => sum + line.quantity, 0);
        if (quantity < operation.beforeQuantity + operation.quantity) break;
        await db.odaTransferOperation.update({
          where: { id: operation.id },
          data: { state: "CONFIRMED" },
        });
      } catch {
        break;
      }
    }
    await db.odaTransferOperation.updateMany({
      where: { transferId: id, state: "PENDING" },
      data: { state: "FAILED" },
    });
    return transferStatus(await completeConfirmed(db, householdId, id));
  } catch {
    // Once a remote write may have happened, retain its durable outcome for recovery.
    const transfer = await db.odaTransfer.findUniqueOrThrow({
      where: { id },
      include: { operations: true },
    });
    const hasRemoteOutcome = transfer.operations.some(
      (operation) =>
        operation.state === "WRITING" || operation.state === "CONFIRMED",
    );
    return transferStatus(
      await db.odaTransfer.update({
        where: { id },
        data: {
          state: hasRemoteOutcome ? "UNCERTAIN" : "COMPLETED",
          message: hasRemoteOutcome
            ? "Oda may have received some items. Check the Oda cart before sending again."
            : "Could not send to Oda. Your items are still on the list. Try again.",
        },
      }),
    );
  }
}

export async function recover(
  db: PrismaClient,
  householdId: string,
  id: string,
) {
  const claimed = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${householdId} FOR UPDATE`;
    const transfer = await tx.odaTransfer.findUniqueOrThrow({
      where: { id, householdId },
      include: { operations: true },
    });
    if (transfer.state !== "UNCERTAIN") return null;
    await tx.odaTransfer.update({ where: { id }, data: { state: "SENDING" } });
    return transfer;
  });
  if (!claimed)
    return transferStatus(
      await db.odaTransfer.findUniqueOrThrow({ where: { id, householdId } }),
    );
  try {
    const uncertain = claimed.operations.filter(
      (operation) =>
        operation.state === "WRITING" && operation.canUseCartCoverage,
    );
    const connection = await db.odaConnection.findUnique({
      where: { householdId },
    });
    if (uncertain.length && connection?.connectionId === claimed.connectionId) {
      const cart = cartSchema.parse(await odaTool(db, householdId, "get_cart"));
      const present = new Set(
        cart.groups
          .flatMap((group) => group.items)
          .filter((item) => item.quantity > 0)
          .map((item) => item.product.id),
      );
      await db.odaTransferOperation.updateMany({
        where: {
          id: {
            in: uncertain
              .filter((operation) => present.has(operation.productId))
              .map((operation) => operation.id),
          },
          state: "WRITING",
        },
        data: { state: "CONFIRMED" },
      });
    }
    return transferStatus(await completeConfirmed(db, householdId, id));
  } catch {
    return transferStatus(
      await db.odaTransfer.update({
        where: { id },
        data: {
          state: "UNCERTAIN",
          message:
            "Could not recover the transfer. Check the Oda connection and try again.",
        },
      }),
    );
  }
}
