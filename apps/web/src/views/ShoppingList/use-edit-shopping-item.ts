import { normalizeShoppingName, normalizeUnit } from "@planeatrepeat/shared";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { api, type RouterInputs, type RouterOutputs } from "~/utils/api";

type Item = RouterOutputs["shoppingList"]["list"][number];
export type ShoppingEdit = {
  item: Item;
  recent: boolean;
  input: RouterInputs["shoppingList"]["edit"];
};
type Edit = ShoppingEdit & {
  key: string;
  ownIds: string[];
  conflictKeys: string[];
  running: boolean;
  quantityChanged: boolean;
  before: { list: Item[]; recent: Item[] };
};

function applyDraft(item: Item, edit: Edit): Item {
  if (item.ownItemId !== edit.item.ownItemId) return item;
  const input = edit.input;
  const name = input.name.trim();
  const trimmedNote = input.note?.trim() ?? "";
  const note = trimmedNote.length > 0 ? trimmedNote : null;
  const ownItem = {
    ...item.ownItem,
    name,
    note,
    normalizedName: normalizeShoppingName(name),
    normalizedNote: normalizeShoppingName(note ?? ""),
    category: input.category ?? item.ownItem.category,
    usuallyHave: input.usuallyHave ?? item.ownItem.usuallyHave,
    ...(input.odaProduct !== undefined
      ? {
          odaProductId: input.odaProduct?.id ?? null,
          odaProductName: input.odaProduct?.name ?? null,
          odaProductDescription: input.odaProduct?.description ?? null,
        }
      : {}),
  };
  return {
    ...item,
    ownItem,
    name,
    note,
    normalizedName: ownItem.normalizedName,
    ...(item.id === input.id && edit.quantityChanged
      ? { amount: input.amount, unit: normalizeUnit(input.unit) }
      : {}),
  };
}

export function useEditShoppingItem(
  list: Item[],
  recent: Item[],
  isCurrent: () => boolean,
) {
  const utils = api.useUtils();
  const queue = useRef<Edit[]>([]);
  const [pending, setPending] = useState<Edit[]>([]);
  const [failedEdits, setFailedEdits] = useState<Edit[]>([]);
  const publish = () => setPending([...queue.current]);
  const mutation = useMutation({
    networkMode: "always",
    retry: false,
    meta: { handlesError: true },
    mutationFn: (edit: ShoppingEdit) =>
      edit.recent
        ? utils.client.shoppingList.editRecent.mutate(edit.input)
        : utils.client.shoppingList.edit.mutate(edit.input),
  });
  const save = async (edit: Edit) => {
    try {
      const saved = await mutation.mutateAsync(edit);
      if (!isCurrent()) return;
      await Promise.all([
        utils.shoppingList.list.cancel(),
        utils.shoppingList.recent.cancel(),
        utils.shoppingList.sources.cancel(),
        utils.shoppingList.usuallyHave.cancel(),
      ]);
      if (!isCurrent()) return;
      const affected = new Set(saved.affectedOwnItemIds);
      utils.shoppingList.list.setData(undefined, (items = []) => [
        ...items.filter((item) => !affected.has(item.ownItemId)),
        ...saved.items,
      ]);
      utils.shoppingList.recent.setData(undefined, (items = []) => {
        const active = new Set(saved.items.map((item) => item.ownItemId));
        return [
          ...items.filter((item) => !affected.has(item.ownItemId)),
          ...saved.recentItems.filter((item) => !active.has(item.ownItemId)),
        ]
          .sort(
            (a, b) => b.recentlyUsedAt.getTime() - a.recentlyUsedAt.getTime(),
          )
          .slice(0, 25);
      });
      utils.shoppingList.sources.setData(undefined, (sources) =>
        sources
          ?.map((source) =>
            source.id === saved.ownItemId ? saved.ownItem : source,
          )
          .filter(
            (source) =>
              source.id === undefined ||
              !affected.has(source.id) ||
              source.id === saved.ownItemId,
          ),
      );
      utils.shoppingList.usuallyHave.setData(
        undefined,
        (items) =>
          items && [
            ...items.filter((item) => !affected.has(item.id)),
            ...(saved.ownItem.usuallyHave ? [saved.ownItem] : []),
          ],
      );
      // Later edits must address the requirement and Own Item that survived a merge.
      const remap = (next: Edit): Edit => {
        const sourceChanged = affected.has(next.item.ownItemId);
        const targetsSavedIdentity =
          normalizeShoppingName(next.input.name) ===
            saved.ownItem.normalizedName &&
          normalizeShoppingName(next.input.note ?? "") ===
            saved.ownItem.normalizedNote;
        if (!sourceChanged && !targetsSavedIdentity) return next;
        const id = sourceChanged
          ? (saved.mergedIds[next.input.id] ?? next.input.id)
          : next.input.id;
        const canonical = (next.recent ? saved.recentItems : saved.items).find(
          (item) => item.id === id,
        );
        const quantity =
          sourceChanged && canonical && !next.quantityChanged
            ? { amount: canonical.amount, unit: canonical.unit }
            : {};
        return {
          ...next,
          item: sourceChanged
            ? {
                ...next.item,
                id,
                ownItemId: saved.ownItemId,
                ownItem: saved.ownItem,
              }
            : next.item,
          input: { ...next.input, id, ...quantity },
          before: {
            list: [
              ...next.before.list.filter(
                (item) => !affected.has(item.ownItemId),
              ),
              ...saved.items,
            ],
            recent: [
              ...next.before.recent.filter(
                (item) => !affected.has(item.ownItemId),
              ),
              ...saved.recentItems.filter(
                (item) =>
                  !saved.items.some(
                    (active) => active.ownItemId === item.ownItemId,
                  ),
              ),
            ],
          },
          ownIds: [...new Set([...next.ownIds, saved.ownItemId])],
          conflictKeys: [...new Set([...next.conflictKeys, saved.ownItemId])],
        };
      };
      queue.current = queue.current.map((next) =>
        next === edit ? next : remap(next),
      );
      setFailedEdits((edits) => edits.map(remap));
      const definitionChanged =
        edit.input.name.trim() !== edit.item.name ||
        (edit.input.note?.trim() ?? "") !== (edit.item.note ?? "");
      if (definitionChanged || edit.input.category !== undefined)
        void utils.shoppingList.sources.invalidate();
      if (
        definitionChanged ||
        edit.input.usuallyHave !== undefined ||
        edit.input.category !== undefined
      )
        void utils.shoppingList.usuallyHave.invalidate();
      if (
        edit.input.odaProduct !== undefined ||
        definitionChanged ||
        edit.input.amount !== edit.item.amount ||
        normalizeUnit(edit.input.unit) !== edit.item.unit
      )
        void utils.oda.transfer.invalidate();
    } catch {
      if (!isCurrent()) return;
      setFailedEdits((edits) => [...edits, edit]);
      // Later quantity-only edits must not retain this failed category or preference.
      queue.current = queue.current.map((next) => ({
        ...next,
        before: {
          list: [
            ...next.before.list.filter(
              (item) => !edit.ownIds.includes(item.ownItemId),
            ),
            ...edit.before.list.filter((item) =>
              next.ownIds.includes(item.ownItemId),
            ),
          ],
          recent: [
            ...next.before.recent.filter(
              (item) => !edit.ownIds.includes(item.ownItemId),
            ),
            ...edit.before.recent.filter((item) =>
              next.ownIds.includes(item.ownItemId),
            ),
          ],
        },
      }));
    } finally {
      if (!isCurrent()) return;
      queue.current = queue.current.filter((next) => next.key !== edit.key);
      publish();
      startReady();
      void utils.shoppingList.list.invalidate();
      void utils.shoppingList.recent.invalidate();
    }
  };
  const startReady = () => {
    const occupied = new Set<string>();
    for (const edit of queue.current) {
      const blocked = edit.conflictKeys.some((id) => occupied.has(id));
      edit.conflictKeys.forEach((id) => occupied.add(id));
      if (!edit.running && !blocked) {
        edit.running = true;
        void save(edit);
      }
    }
  };
  const dismissFailedEdit = (key: string) =>
    setFailedEdits((edits) => edits.filter((edit) => edit.key !== key));
  const editItem = (draft: ShoppingEdit, failedKey?: string) => {
    if (failedKey) dismissFailedEdit(failedKey);
    const destination = [...list, ...recent].filter(
      (item) =>
        item.normalizedName === normalizeShoppingName(draft.input.name) &&
        item.ownItem.normalizedNote ===
          normalizeShoppingName(draft.input.note ?? ""),
    );
    const ownIds = [
      ...new Set([
        draft.item.ownItemId,
        ...destination.map((item) => item.ownItemId),
      ]),
    ];
    // The normalized destination also orders two renames into a new identity.
    const conflictKeys = [
      ...ownIds,
      JSON.stringify([
        normalizeShoppingName(draft.input.name),
        normalizeShoppingName(draft.input.note ?? ""),
      ]),
    ];
    queue.current.push({
      ...draft,
      key: crypto.randomUUID(),
      ownIds,
      conflictKeys,
      running: false,
      quantityChanged:
        draft.input.amount !== draft.item.amount ||
        normalizeUnit(draft.input.unit) !== draft.item.unit,
      before: {
        list: overlay(list, false).filter((item) =>
          ownIds.includes(item.ownItemId),
        ),
        recent: overlay(recent, true).filter((item) =>
          ownIds.includes(item.ownItemId),
        ),
      },
    });
    publish();
    startReady();
  };
  const overlay = (items: Item[], isRecent: boolean) => {
    const frozenIds = new Set<string>();
    return pending.reduce((items, edit) => {
      const freeze = new Set(edit.ownIds.filter((id) => !frozenIds.has(id)));
      edit.ownIds.forEach((id) => frozenIds.add(id));
      return [
        ...items.filter((item) => !freeze.has(item.ownItemId)),
        ...(isRecent ? edit.before.recent : edit.before.list).filter((item) =>
          freeze.has(item.ownItemId),
        ),
      ].map((item) => applyDraft(item, edit));
    }, items);
  };
  return {
    editedItems: overlay(list, false),
    editedRecentItems: overlay(recent, true),
    editItem,
    failedEdits,
    dismissFailedEdit,
    editingOwnIds: new Set(pending.flatMap((edit) => edit.ownIds)),
  };
}
