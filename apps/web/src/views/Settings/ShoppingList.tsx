import { OdaConnection } from "../ShoppingList/OdaConnection";
import type { ShoppingLanguage } from "@planeatrepeat/db";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/utils/api";
import { useShoppingCategoryHeadings } from "~/hooks/use-shopping-category-headings";
import { cn } from "~/lib/utils";

export function ShoppingList({ language }: { language: ShoppingLanguage }) {
  const { enabled, setEnabled } = useShoppingCategoryHeadings();
  const utils = api.useUtils();
  const update = api.household.updateHousehold.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.household.household.invalidate(),
        utils.shoppingList.categories.invalidate(),
        utils.shoppingList.sources.invalidate(),
      ]);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shopping List</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-4 pb-4">
          <div>
            <p className="text-sm font-bold">Show category headings</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Applies only in this browser.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Show category headings"
            aria-checked={enabled}
            className={cn(
              "focus-visible:ring-ring relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              enabled ? "bg-primary" : "bg-muted-foreground/30",
            )}
            onClick={() => setEnabled(!enabled)}
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute left-1 top-1 size-5 rounded-full bg-white shadow-sm transition-transform",
                enabled && "translate-x-5",
              )}
            />
          </button>
        </div>
        <Label htmlFor="shopping-language">Shopping language</Label>
        <Select
          value={language}
          disabled={update.isPending}
          onValueChange={(value) => {
            if (value === "en" || value === "no")
              update.mutate({ shoppingLanguage: value });
          }}
        >
          <SelectTrigger id="shopping-language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="no">Norwegian</SelectItem>
          </SelectContent>
        </Select>
        {update.error && (
          <p role="alert" className="text-destructive text-sm">
            {update.error.message}
          </p>
        )}
        <OdaConnection />
      </CardContent>
    </Card>
  );
}
