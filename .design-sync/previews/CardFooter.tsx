import * as React from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@planeatrepeat/web";
import { CalendarPlus } from "lucide-react";

export const FormActions = () => (
  <Card className="w-96">
    <CardHeader>
      <CardTitle className="font-serif text-xl">New dinner</CardTitle>
      <CardDescription>
        Give it a name now — you can add tags and a recipe link later.
      </CardDescription>
    </CardHeader>
    <CardContent className="text-muted-foreground text-sm">
      Baked feta pasta
    </CardContent>
    <CardFooter className="justify-end gap-2">
      <Button variant="secondary">Cancel</Button>
      <Button>Save dinner</Button>
    </CardFooter>
  </Card>
);

export const SingleAction = () => (
  <Card className="w-80">
    <CardHeader>
      <CardTitle className="font-serif text-xl">Thursday is empty</CardTitle>
      <CardDescription>Nothing planned for this day yet.</CardDescription>
    </CardHeader>
    <CardFooter>
      <Button className="w-full">
        <CalendarPlus className="mr-2 h-4 w-4" />
        Plan a dinner
      </Button>
    </CardFooter>
  </Card>
);

export const MetaFooter = () => (
  <Card className="w-96">
    <CardHeader>
      <CardTitle className="font-serif text-xl">Fish tacos</CardTitle>
    </CardHeader>
    <CardContent className="text-muted-foreground text-sm">
      Planned for Thursday 30 July.
    </CardContent>
    <CardFooter className="justify-between">
      <span className="text-muted-foreground text-xs">
        Last cooked 3 weeks ago
      </span>
      <Button variant="outline" size="sm">
        Move day
      </Button>
    </CardFooter>
  </Card>
);
