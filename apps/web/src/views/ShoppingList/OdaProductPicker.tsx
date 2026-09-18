import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import type { OdaProductPreference } from "~/lib/oda-product";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";

export function OdaProductPicker({
  product,
  itemName,
  onChange,
}: {
  product: OdaProductPreference | null;
  itemName: string;
  onChange: (product: OdaProductPreference | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label htmlFor="oda-product">Oda product</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="oda-product"
            type="button"
            role="combobox"
            aria-expanded={open}
            variant="outline"
            className="h-12 w-full justify-between rounded-xl px-3 font-normal"
          >
            <span className="min-w-0 text-left">
              <span className="block truncate">
                {product?.name ?? "Automatic matching"}
              </span>
              {product?.description && (
                <span className="text-muted-foreground block truncate text-xs">
                  {product.description}
                </span>
              )}
            </span>
            <ChevronsUpDown className="text-muted-foreground ml-2 size-4 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] overflow-hidden p-0">
          <OdaProductSearch
            product={product}
            itemName={itemName}
            onSelect={(selected) => {
              onChange(selected);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function OdaProductSearch({
  product,
  itemName,
  onSelect,
}: {
  product: OdaProductPreference | null;
  itemName: string;
  onSelect: (product: OdaProductPreference | null) => void;
}) {
  const [query, setQuery] = useState((product?.name ?? itemName).slice(0, 200));
  const [searchQuery, setSearchQuery] = useState(query.trim());
  useEffect(() => {
    const timeout = setTimeout(() => setSearchQuery(query.trim()), 300);
    return () => clearTimeout(timeout);
  }, [query]);
  const results = api.oda.searchProducts.useQuery(
    { query: searchQuery },
    {
      enabled: searchQuery.length >= 2,
      retry: false,
      refetchOnWindowFocus: false,
    },
  );
  const searching = query.trim() !== searchQuery || results.isFetching;

  return (
    <Command shouldFilter={false} loop>
      <CommandInput
        aria-label="Search Oda products"
        placeholder="Search Oda…"
        value={query}
        onValueChange={setQuery}
        maxLength={200}
      />
      <CommandList className="max-h-[min(280px,calc(var(--radix-popover-content-available-height)-48px))]">
        <CommandGroup>
          <CommandItem value="automatic" onSelect={() => onSelect(null)}>
            <Check className={cn(product && "opacity-0")} />
            Automatic matching
          </CommandItem>
        </CommandGroup>
        <div role="status" className="text-muted-foreground px-3 text-sm">
          {searching ? (
            <p className="py-3">Searching…</p>
          ) : query.trim().length < 2 ? (
            <p className="py-3">Type to search</p>
          ) : results.isSuccess && results.data.length === 0 ? (
            <p className="py-3">No products found</p>
          ) : null}
        </div>
        {!searching && searchQuery.length >= 2 && (
          <CommandGroup>
            {results.isError && (
              <CommandItem
                value="retry"
                onSelect={() => void results.refetch()}
              >
                Could not search Oda. Retry
              </CommandItem>
            )}
            {results.data?.map((result) => (
              <CommandItem
                key={result.id}
                value={String(result.id)}
                disabled={!result.availability?.isAvailable}
                onSelect={() => onSelect(result)}
                className="items-start py-2.5"
              >
                <Check
                  className={cn(
                    "mt-0.5",
                    product?.id !== result.id && "opacity-0",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block">{result.name}</span>
                  <span className="text-muted-foreground block text-xs">
                    {result.description}
                  </span>
                </span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {result.availability?.isAvailable
                    ? `${result.price} kr`
                    : "Unavailable"}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
}
