import { ChevronLeft, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { LoadingIndicator } from "~/components/LoadingIndicator";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useShopping, useShoppingWrite } from "./ShoppingProvider";
import { api } from "~/utils/api";

export function UsuallyHaveView() {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const utils = api.useUtils();
  const { isDeletingOwnItem } = useShopping();
  const reserve = useShoppingWrite();
  const preferences = api.shoppingList.usuallyHave.useQuery(undefined, {
    refetchInterval: 2000,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    retry: false,
  });
  const setPreference = api.shoppingList.setUsuallyHave.useMutation({
    networkMode: "always",
    retry: false,
    onMutate: async () => {
      const ticket = reserve();
      await ticket.ready;
      return ticket;
    },
    onSettled: (_result, _error, _input, ticket) => ticket?.release(),
    onSuccess: async (_, input) => {
      await Promise.all([
        utils.shoppingList.usuallyHave.invalidate(),
        utils.shoppingList.list.invalidate(),
        utils.shoppingList.recent.invalidate(),
        ...("name" in input ? [utils.shoppingList.sources.invalidate()] : []),
      ]);
      if (input.excluded && "name" in input) {
        setName("");
        inputRef.current?.focus();
      }
    },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-5 flex items-center gap-3">
        <Link
          href="/shopping-list"
          aria-label="Back to shopping list"
          className="border-border text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full border"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="font-serif text-[30px] leading-tight">Usually have</h1>
      </header>
      <p className="text-muted-foreground mb-4 text-[12.5px] leading-relaxed">
        Skipped when a recipe is added to the shopping list.
      </p>
      <form
        className="mb-3 flex gap-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && !setPreference.isPending)
            setPreference.mutate({ name, excluded: true });
        }}
      >
        <Input
          ref={inputRef}
          aria-label="Ingredient name"
          placeholder="Add an ingredient"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={setPreference.isPending}
          className="h-12 min-w-0 rounded-xl bg-white"
        />
        <Button
          type="submit"
          disabled={!name.trim() || setPreference.isPending}
          className="h-12 rounded-xl px-6"
        >
          Add
        </Button>
      </form>
      {preferences.isPending && (
        <LoadingIndicator label="Loading Usually have…" />
      )}
      {(preferences.isError || setPreference.isError) && (
        <p role="alert" className="text-destructive mb-3 text-sm">
          Could not {setPreference.isError ? "save" : "load"} Usually have.
          Check your connection and try again.
        </p>
      )}
      {!!preferences.data?.length && (
        <ul
          aria-label="Usually have ingredients"
          className="border-border divide-border divide-y overflow-hidden rounded-[14px] border bg-white"
        >
          {preferences.data
            .filter((preference) => !isDeletingOwnItem(preference.id))
            .map((preference) => (
              <li
                key={preference.id}
                className="flex min-h-14 items-center gap-3 pl-3.5 pr-1.5"
              >
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                  {preference.name}
                  {preference.note && (
                    <span className="text-muted-foreground ml-1 text-sm">
                      {preference.note}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${[preference.name, preference.note].filter(Boolean).join(", ")} from Usually have`}
                  disabled={setPreference.isPending}
                  onClick={() =>
                    setPreference.mutate({
                      id: preference.id,
                      excluded: false,
                    })
                  }
                  className="text-muted-foreground focus-visible:ring-ring flex size-11 shrink-0 items-center justify-center rounded-xl outline-none focus-visible:ring-2 disabled:opacity-50"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
