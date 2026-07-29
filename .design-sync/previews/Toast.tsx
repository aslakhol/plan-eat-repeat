import * as React from "react";
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@planeatrepeat/web";

// The Radix toast root portals into the viewport, and the app's viewport is
// `fixed` to the screen corner. For a static preview card we keep the same
// components but pin the viewport in flow so it photographs inside the cell.
const ToastFrame = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider duration={Infinity}>
    {children}
    <ToastViewport className="static flex-col p-0" />
  </ToastProvider>
);

export const Saved = () => (
  <ToastFrame>
    <Toast>
      <div className="grid gap-1">
        <ToastTitle>Dinner saved</ToastTitle>
        <ToastDescription>
          Fish tacos was added to Thursday.
        </ToastDescription>
      </div>
      <ToastClose className="opacity-100" />
    </Toast>
  </ToastFrame>
);

export const Destructive = () => (
  <ToastFrame>
    <Toast variant="destructive">
      <div className="grid gap-1">
        <ToastTitle>Could not save dinner</ToastTitle>
        <ToastDescription>
          A dinner called Tomato pasta already exists in this household.
        </ToastDescription>
      </div>
      <ToastClose className="opacity-100" />
    </Toast>
  </ToastFrame>
);

export const WithAction = () => (
  <ToastFrame>
    <Toast>
      <div className="grid gap-1">
        <ToastTitle>Removed from the plan</ToastTitle>
        <ToastDescription>Lentil soup is off Wednesday.</ToastDescription>
      </div>
      <ToastAction altText="Undo removing the dinner">Undo</ToastAction>
    </Toast>
  </ToastFrame>
);
