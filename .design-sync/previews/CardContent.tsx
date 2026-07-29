import * as React from "react";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@planeatrepeat/web";

export const NotesBody = () => (
  <Card className="w-96">
    <CardHeader>
      <CardTitle className="font-serif text-xl">Tomato pasta</CardTitle>
      <CardDescription>Notes</CardDescription>
    </CardHeader>
    <CardContent className="space-y-2 text-sm">
      <p>
        Fry the garlic gently, add two tins of tomatoes and let it reduce while
        the pasta boils.
      </p>
      <p className="text-muted-foreground">
        Double the sauce — it freezes well for a busy Tuesday.
      </p>
    </CardContent>
  </Card>
);

export const TagsBody = () => (
  <Card className="w-64">
    <CardHeader className="p-4 pb-2">
      <CardTitle className="line-clamp-2 font-serif text-base font-medium leading-tight">
        Lentil soup with bread
      </CardTitle>
    </CardHeader>
    <CardContent className="p-4 pt-2">
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">Vegetarian</Badge>
        <Badge variant="secondary">25 min</Badge>
      </div>
    </CardContent>
  </Card>
);

export const ListBody = () => (
  <Card className="w-80">
    <CardHeader>
      <CardTitle className="font-serif text-xl">This week</CardTitle>
    </CardHeader>
    <CardContent>
      <ul className="space-y-3 text-sm">
        {[
          { day: "Monday", dinner: "Tomato pasta" },
          { day: "Tuesday", dinner: "Chicken curry" },
          { day: "Wednesday", dinner: "Lentil soup" },
          { day: "Thursday", dinner: "Fish tacos" },
        ].map((entry) => (
          <li key={entry.day} className="flex items-center justify-between">
            <span className="text-muted-foreground">{entry.day}</span>
            <span>{entry.dinner}</span>
          </li>
        ))}
      </ul>
    </CardContent>
  </Card>
);
