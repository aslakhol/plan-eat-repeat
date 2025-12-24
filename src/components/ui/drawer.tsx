import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "src/lib/utils";

const Drawer = ({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root
    shouldScaleBackground={shouldScaleBackground}
    {...props}
  />
);
Drawer.displayName = "Drawer";

const DrawerTrigger = DrawerPrimitive.Trigger;

const DrawerPortal = DrawerPrimitive.Portal;

const DrawerClose = DrawerPrimitive.Close;

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/80", className)}
    {...props}
  />
));
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  // When the mobile keyboard overlays the viewport (common on iOS, and can happen on Android),
  // we need extra bottom padding inside the scroll container so the last inputs can scroll
  // above the keyboard.
  const [keyboardInsetPx, setKeyboardInsetPx] = React.useState(0);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      // Approximate keyboard height in px.
      // When the keyboard opens, visualViewport.height shrinks and/or offsetTop changes.
      const inset = window.innerHeight - vv.height - vv.offsetTop;
      setKeyboardInsetPx(Math.max(0, Math.round(inset)));
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  const scrollFocusedIntoView = React.useCallback(
    (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return;
      const tag = target.tagName.toLowerCase();
      if (!["input", "textarea", "select"].includes(tag)) return;

      // Only intervene when the keyboard is likely open.
      if (keyboardInsetPx <= 0) return;

      // Android is timing-sensitive; do a couple of deferred attempts to avoid "sometimes".
      const el = target;
      const tryScroll = () => {
        try {
          el.scrollIntoView({ block: "center", inline: "nearest" });
        } catch {
          // noop
        }
      };

      requestAnimationFrame(tryScroll);
      window.setTimeout(tryScroll, 60);
      window.setTimeout(tryScroll, 250);
    },
    [keyboardInsetPx],
  );

  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        ref={ref}
        onFocusCapture={(e) => scrollFocusedIntoView(e.target)}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[96dvh] flex-col overflow-y-auto rounded-t-[10px] border bg-background p-4",
          className,
        )}
        style={{
          // Keep existing padding, but add keyboard room at the bottom so content can scroll above it.
          paddingBottom: `calc(1rem + ${keyboardInsetPx}px + env(safe-area-inset-bottom))`,
          scrollPaddingBottom: `calc(1rem + ${keyboardInsetPx}px + env(safe-area-inset-bottom))`,
        }}
        {...props}
      >
        <div className="mx-auto mb-4 h-1.5 w-[100px] shrink-0 rounded-full bg-muted-foreground/20" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
});
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("grid gap-1.5 text-center sm:text-left", className)}
    {...props}
  />
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-auto flex flex-col gap-2", className)} {...props} />
);
DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn(
      "pb-2 text-lg font-semibold leading-none tracking-tight",
      className,
    )}
    {...props}
  />
));
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
