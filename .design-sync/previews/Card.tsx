import * as React from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@planeatrepeat/web";
import { Plus } from "lucide-react";

export const Basic = () => (
  <Card className="max-w-md">
    <CardHeader>
      <CardTitle>Create household</CardTitle>
      <CardDescription>
        To use PlanEatRepeat you need a household. You can invite the people you
        cook for later.
      </CardDescription>
    </CardHeader>
    <CardContent className="text-muted-foreground text-sm">
      A household shares its dinners and its weekly plan.
    </CardContent>
    <CardFooter className="justify-end gap-2">
      <Button variant="secondary">Cancel</Button>
      <Button>Create household</Button>
    </CardFooter>
  </Card>
);

export const DinnerGrid = () => (
  <div className="grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
    {[
      { name: "Tomato pasta", tags: ["Vegetarian", "20 min"] },
      { name: "Fish tacos", tags: ["Friday"] },
      { name: "Chicken curry with rice", tags: ["Family favourite"] },
    ].map((dinner) => (
      <Card
        key={dinner.name}
        className="hover:bg-accent/50 flex h-full min-h-[100px] cursor-pointer flex-col justify-between transition-colors"
      >
        <CardHeader className="p-4 pb-2">
          <CardTitle className="line-clamp-2 font-serif text-base font-medium leading-tight sm:text-lg">
            {dinner.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="flex flex-wrap gap-1">
            {dinner.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

export const AddPlaceholder = () => (
  <Card className="hover:border-primary/50 hover:bg-accent/50 flex h-full min-h-[120px] w-56 cursor-pointer flex-col items-center justify-center border-dashed bg-transparent transition-colors">
    <CardContent className="text-muted-foreground hover:text-primary flex h-full flex-col items-center justify-center gap-2 p-4">
      <Plus className="h-6 w-6" />
      <span className="text-sm">New dinner</span>
    </CardContent>
  </Card>
);
