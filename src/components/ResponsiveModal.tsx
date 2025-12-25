import * as React from "react";
import { useIsMobile } from "src/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "src/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "src/components/ui/drawer";

export const ResponsiveModal = ({
  children,
  open,
  onOpenChange,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const isMobile = useIsMobile();

  // On iOS Safari/Chrome the keyboard often overlays the page instead of resizing the viewport,
  // so Vaul's input repositioning helps keep focused inputs visible.
  // On Android Chrome the viewport typically *does* resize; enabling repositioning can
  // overcompensate and cause the "drawer jumps / input pushed out of view" behavior.
  const shouldRepositionInputs = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    const ua = window.navigator.userAgent ?? "";
    const isiOSDevice = /iPad|iPhone|iPod/.test(ua);
    // iPadOS 13+ reports as Mac; detect via touch points.
    const isiPadOS =
      window.navigator.platform === "MacIntel" &&
      (window.navigator.maxTouchPoints ?? 0) > 1;
    return isiOSDevice || isiPadOS;
  }, []);

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        {children}
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  );
};

export const ResponsiveModalTrigger = ({
  children,
  asChild,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <DrawerTrigger asChild={asChild}>{children}</DrawerTrigger>;
  }

  return <DialogTrigger asChild={asChild}>{children}</DialogTrigger>;
};

export const ResponsiveModalContent = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <DrawerContent className={className}>{children}</DrawerContent>;
  }

  return <DialogContent className={className}>{children}</DialogContent>;
};

export const ResponsiveModalHeader = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <DrawerHeader className={className}>{children}</DrawerHeader>;
  }

  return <DialogHeader className={className}>{children}</DialogHeader>;
};

export const ResponsiveModalTitle = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <DrawerTitle className={className}>{children}</DrawerTitle>;
  }

  return <DialogTitle className={className}>{children}</DialogTitle>;
};

export const ResponsiveModalDescription = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <DrawerDescription className={className}>{children}</DrawerDescription>
    );
  }

  return (
    <DialogDescription className={className}>{children}</DialogDescription>
  );
};
