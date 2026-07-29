import * as React from "react";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@planeatrepeat/web";

// `Toaster` takes no props and renders whatever `toast()` has queued, so a
// static render of it is an empty viewport. These cells reproduce exactly the
// markup Toaster emits for queued toasts (ToastProvider → Toast → title /
// description / close → ToastViewport), with the viewport pinned in flow
// instead of fixed to the screen corner so it photographs inside the cell.
const ToasterFrame = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider duration={Infinity}>
    {children}
    <ToastViewport className="static flex-col gap-2 p-0" />
  </ToastProvider>
);

export const QueuedToast = () => (
  <ToasterFrame>
    <Toast>
      <div className="grid gap-1">
        <ToastTitle>Role updated</ToastTitle>
        <ToastDescription>Marte is now an admin.</ToastDescription>
      </div>
      <ToastClose className="opacity-100" />
    </Toast>
  </ToasterFrame>
);

export const StackedToasts = () => (
  <ToasterFrame>
    <Toast>
      <div className="grid gap-1">
        <ToastTitle>Dinner saved</ToastTitle>
        <ToastDescription>Baked feta pasta added to Tuesday.</ToastDescription>
      </div>
      <ToastClose className="opacity-100" />
    </Toast>
    <Toast variant="destructive">
      <div className="grid gap-1">
        <ToastTitle>Invite expired</ToastTitle>
        <ToastDescription>Send Jonas a new household link.</ToastDescription>
      </div>
      <ToastClose className="opacity-100" />
    </Toast>
  </ToasterFrame>
);
