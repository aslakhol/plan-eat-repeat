import * as React from "react";
import {
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@planeatrepeat/web";

// SelectContent portals to document.body, so the trigger is what keeps the
// card root non-empty while `defaultOpen` shows the list.
export const MemberRole = () => (
  <div className="w-56 space-y-2">
    <Label htmlFor="member-role">Role</Label>
    <Select defaultValue="MEMBER" defaultOpen>
      <SelectTrigger id="member-role" className="w-[120px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ADMIN">Admin</SelectItem>
        <SelectItem value="MEMBER">Member</SelectItem>
      </SelectContent>
    </Select>
  </div>
);

export const Grouped = () => (
  <div className="w-60 space-y-2">
    <Label htmlFor="plan-day">Move dinner to</Label>
    <Select defaultValue="thursday" defaultOpen>
      <SelectTrigger id="plan-day" className="w-full">
        <SelectValue placeholder="Pick a day" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>This week</SelectLabel>
          <SelectItem value="monday">Monday</SelectItem>
          <SelectItem value="tuesday">Tuesday</SelectItem>
          <SelectItem value="wednesday">Wednesday</SelectItem>
          <SelectItem value="thursday">Thursday</SelectItem>
          <SelectItem value="friday">Friday</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  </div>
);

export const Closed = () => (
  <div className="w-60 space-y-2">
    <Label htmlFor="closed-role">Role</Label>
    <Select defaultValue="ADMIN">
      <SelectTrigger id="closed-role" className="w-[120px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ADMIN">Admin</SelectItem>
        <SelectItem value="MEMBER">Member</SelectItem>
      </SelectContent>
    </Select>
  </div>
);

export const PlaceholderAndDisabled = () => (
  <div className="w-60 space-y-4">
    <div className="space-y-2">
      <Label htmlFor="empty-week">Week</Label>
      <Select>
        <SelectTrigger id="empty-week" className="w-full">
          <SelectValue placeholder="Pick a week" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="this">This week</SelectItem>
          <SelectItem value="next">Next week</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div className="space-y-2">
      <Label htmlFor="owner-role">Role</Label>
      <Select defaultValue="ADMIN" disabled>
        <SelectTrigger id="owner-role" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ADMIN">Admin</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
);
