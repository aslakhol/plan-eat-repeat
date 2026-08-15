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
import { cn } from "src/lib/utils";

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
  scrollViewport = false,
  scrollViewportClassName,
}: {
  children: React.ReactNode;
  className?: string;
  scrollViewport?: boolean;
  scrollViewportClassName?: string;
}) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <DrawerContent className={cn(className, "overflow-hidden")}>
        {scrollViewport ? (
          <ResponsiveModalScrollViewport className={scrollViewportClassName}>
            {children}
          </ResponsiveModalScrollViewport>
        ) : (
          children
        )}
      </DrawerContent>
    );
  }

  return <DialogContent className={className}>{children}</DialogContent>;
};

export function ResponsiveModalScrollViewport({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const isMobile = useIsMobile();

  return (
    <div
      data-responsive-modal-scroll-viewport={isMobile ? "" : undefined}
      className={cn("min-h-0 overflow-y-auto", className)}
      {...props}
    >
      {children}
    </div>
  );
}

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
