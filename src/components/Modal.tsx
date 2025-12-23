import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "src/components/ui/dialog";

export const Modal = ({
  children,
  open,
  onOpenChange,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  );
};

export const ModalTrigger = ({
  children,
  asChild,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) => {
  return <DialogTrigger asChild={asChild}>{children}</DialogTrigger>;
};

export const ModalContent = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return <DialogContent className={className}>{children}</DialogContent>;
};

export const ModalHeader = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return <DialogHeader className={className}>{children}</DialogHeader>;
};

export const ModalTitle = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return <DialogTitle className={className}>{children}</DialogTitle>;
};

export const ModalDescription = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <DialogDescription className={className}>{children}</DialogDescription>
  );
};
