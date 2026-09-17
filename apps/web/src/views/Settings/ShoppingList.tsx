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

export function ShoppingList({ language }: { language: ShoppingLanguage }) {
  const utils = api.useUtils();
  const update = api.household.updateHousehold.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.household.household.invalidate(),
        utils.shoppingList.categories.invalidate(),
      ]);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shopping List</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
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
        <OdaConnection settings />
      </CardContent>
    </Card>
  );
}
