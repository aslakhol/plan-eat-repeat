import * as React from "react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@planeatrepeat/web";

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge>Family favourite</Badge>
    <Badge variant="secondary">Vegetarian</Badge>
    <Badge variant="outline">20 min</Badge>
    <Badge variant="destructive">Missing recipe</Badge>
  </div>
);

export const DinnerTags = () => (
  <Card className="w-64">
    <CardHeader className="p-4 pb-2">
      <CardTitle className="font-serif text-lg font-medium leading-tight">
        Chickpea curry with rice
      </CardTitle>
    </CardHeader>
    <CardContent className="p-4 pt-2">
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">Vegetarian</Badge>
        <Badge variant="secondary">30 min</Badge>
        <Badge variant="secondary">Leftovers</Badge>
      </div>
    </CardContent>
  </Card>
);

export const TagFilter = () => (
  <div className="max-w-md space-y-2">
    <p className="text-muted-foreground text-sm">Filter dinners by tag</p>
    <div className="flex flex-wrap gap-2">
      <Badge variant="secondary" className="border-primary bg-primary/10 border">
        Vegetarian
      </Badge>
      <Badge variant="secondary">Quick</Badge>
      <Badge variant="secondary" className="border-primary bg-primary/10 border">
        Family favourite
      </Badge>
      <Badge variant="secondary">Friday</Badge>
      <Badge variant="secondary">Fish</Badge>
    </div>
  </div>
);
