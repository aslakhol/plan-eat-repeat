import * as React from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@planeatrepeat/web";
import { Pencil } from "lucide-react";

export const TitleAndDescription = () => (
  <Card className="w-96">
    <CardHeader>
      <CardTitle className="font-serif text-2xl">Household</CardTitle>
      <CardDescription>
        Everyone in Hollund-Nilsen shares these dinners and this week&apos;s
        plan.
      </CardDescription>
    </CardHeader>
    <CardContent className="text-muted-foreground text-sm">
      3 members · 48 dinners
    </CardContent>
  </Card>
);

export const DenseHeader = () => (
  <Card className="flex w-56 flex-col justify-between">
    <CardHeader className="p-4 pb-2">
      <CardTitle className="line-clamp-2 font-serif text-base font-medium leading-tight">
        Salmon with roasted potatoes
      </CardTitle>
    </CardHeader>
    <CardContent className="p-4 pt-2">
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">Fish</Badge>
        <Badge variant="secondary">40 min</Badge>
      </div>
    </CardContent>
  </Card>
);

export const HeaderWithAction = () => (
  <Card className="w-96">
    <CardHeader className="flex-row items-start justify-between space-y-0">
      <div className="space-y-1.5">
        <CardTitle className="font-serif text-xl">Thursday</CardTitle>
        <CardDescription>Fish tacos with lime slaw</CardDescription>
      </div>
      <Button variant="ghost" size="icon">
        <Pencil className="h-4 w-4" />
      </Button>
    </CardHeader>
    <CardContent className="text-muted-foreground text-sm">
      Planned by Marte · serves 4
    </CardContent>
  </Card>
);
