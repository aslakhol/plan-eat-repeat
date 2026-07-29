import * as React from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@planeatrepeat/web";

export const MemberRow = () => (
  <div className="flex items-center space-x-4">
    <Avatar>
      <AvatarImage src="/avatars/aslak.png" alt="Aslak Hollund" />
      <AvatarFallback>AH</AvatarFallback>
    </Avatar>
    <div>
      <h3 className="font-serif text-lg font-semibold leading-tight">
        Aslak Hollund
      </h3>
      <p className="text-muted-foreground text-sm">Admin</p>
    </div>
  </div>
);

export const HouseholdMembers = () => (
  <Card className="w-80">
    <CardHeader>
      <CardTitle className="font-serif text-xl">Members</CardTitle>
    </CardHeader>
    <CardContent>
      <ul className="space-y-4">
        {[
          { name: "Aslak Hollund", initials: "AH", role: "Admin" },
          { name: "Marte Nilsen", initials: "MN", role: "Member" },
          { name: "Jonas Berg", initials: "JB", role: "Member" },
        ].map((member) => (
          <li key={member.name} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={`/avatars/${member.initials}.png`} alt="" />
                <AvatarFallback className="text-xs font-semibold">
                  {member.initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{member.name}</span>
            </div>
            <span className="text-muted-foreground text-xs">{member.role}</span>
          </li>
        ))}
      </ul>
    </CardContent>
  </Card>
);

export const CookingTonight = () => (
  <div className="flex items-center gap-3">
    <div className="flex -space-x-2">
      {["AH", "MN", "JB", "SL"].map((initials) => (
        <Avatar key={initials} className="border-background h-8 w-8 border-2">
          <AvatarImage src={`/avatars/${initials}.png`} alt="" />
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
      ))}
    </div>
    <span className="text-muted-foreground text-sm">
      4 eating Thursday&apos;s fish tacos
    </span>
  </div>
);
