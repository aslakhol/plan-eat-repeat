import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
} from "@planeatrepeat/web";

export const BetweenSections = () => (
  <Card className="w-80">
    <CardHeader>
      <CardTitle className="font-serif text-xl">Household settings</CardTitle>
    </CardHeader>
    <CardContent className="text-sm">
      <div className="space-y-1">
        <p className="font-medium">Name</p>
        <p className="text-muted-foreground">Hollund-Nilsen</p>
      </div>
      <Separator className="my-4" />
      <div className="space-y-1">
        <p className="font-medium">Members</p>
        <p className="text-muted-foreground">Aslak, Marte, Jonas</p>
      </div>
      <Separator className="my-4" />
      <div className="space-y-1">
        <p className="font-medium">Invite link</p>
        <p className="text-muted-foreground">Expires in 6 days</p>
      </div>
    </CardContent>
  </Card>
);

export const VerticalMeta = () => (
  <div className="text-muted-foreground flex h-6 items-center space-x-3 text-sm">
    <span>Vegetarian</span>
    <Separator orientation="vertical" className="h-4" />
    <span>20 min</span>
    <Separator orientation="vertical" className="h-4" />
    <span>Serves 4</span>
    <Separator orientation="vertical" className="h-4" />
    <span>Cooked 12 times</span>
  </div>
);

export const WeekList = () => (
  <div className="w-72 text-sm">
    {["Monday", "Tuesday", "Wednesday"].map((day, i) => (
      <React.Fragment key={day}>
        {i > 0 && <Separator />}
        <div className="flex items-center justify-between py-3">
          <span className="text-muted-foreground">{day}</span>
          <span>
            {["Tomato pasta", "Chicken curry", "Lentil soup"][i]}
          </span>
        </div>
      </React.Fragment>
    ))}
  </div>
);
