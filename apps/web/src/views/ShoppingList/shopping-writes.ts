// Ordinary shopping writes can overlap. Clear and Delete wait for earlier
// writes, then keep later writes behind them until cache reconciliation ends.
export function createShoppingWrites() {
  const forgotten = new Set<string>();
  const pending = new Set<Promise<void>>();
  let barrier = Promise.resolve();
  return {
    forget: (id: string) => forgotten.add(id),
    isForgotten: (id: string) => forgotten.has(id),
    reserve(exclusive = false) {
      const ready = exclusive ? Promise.all([...pending]) : barrier;
      const done = Promise.withResolvers<void>();
      pending.add(done.promise);
      if (exclusive) barrier = done.promise;
      return {
        ready,
        release() {
          pending.delete(done.promise);
          done.resolve();
        },
      };
    },
  };
}
export type ShoppingWrites = ReturnType<typeof createShoppingWrites>;
