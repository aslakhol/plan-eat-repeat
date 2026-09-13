import { ChevronLeft, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { api } from "~/utils/api";

export function UsuallyHaveView() {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const utils = api.useUtils();
  const preferences = api.shoppingList.usuallyHave.useQuery(undefined, {
    refetchInterval: 2000,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    retry: false,
  });
  const setPreference = api.shoppingList.setUsuallyHave.useMutation({
    networkMode: "always",
    retry: false,
    onSuccess: async (_, input) => {
      await utils.shoppingList.usuallyHave.invalidate();
      if (input.excluded) {
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
        <p role="status" className="text-muted-foreground py-8 text-center">
          Loading Usually have…
        </p>
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
          {preferences.data.map((preference) => (
            <li
              key={preference.normalizedName}
              className="flex min-h-14 items-center gap-3 pl-3.5 pr-1.5"
            >
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                {preference.name}
              </span>
              <button
                type="button"
                aria-label={`Remove ${preference.name} from Usually have`}
                disabled={setPreference.isPending}
                onClick={() =>
                  setPreference.mutate({
                    name: preference.name,
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
