import * as React from "react";
import { Card, CardContent, CardHeader, Skeleton } from "@planeatrepeat/web";

export const LoadingDinnerCard = () => (
  <Card className="flex w-56 flex-col justify-between">
    <CardHeader className="p-4 pb-2">
      <Skeleton className="h-5 w-40" />
    </CardHeader>
    <CardContent className="p-4 pt-2">
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
    </CardContent>
  </Card>
);

export const LoadingDinnerGrid = () => (
  <div className="grid max-w-2xl grid-cols-3 gap-3">
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <Card key={i} className="flex min-h-[100px] flex-col justify-between">
        <CardHeader className="p-4 pb-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <Skeleton className="h-5 w-16 rounded-full" />
        </CardContent>
      </Card>
    ))}
  </div>
);

export const LoadingMemberList = () => (
  <div className="w-80 space-y-4">
    {[0, 1, 2].map((i) => (
      <div key={i} className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    ))}
  </div>
);
