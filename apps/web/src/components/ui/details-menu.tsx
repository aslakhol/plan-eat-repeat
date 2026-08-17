import {
  forwardRef,
  type ComponentPropsWithoutRef,
  useCallback,
  useEffect,
  useRef,
} from "react";

const DetailsMenu = forwardRef<
  HTMLDetailsElement,
  ComponentPropsWithoutRef<"details">
>(({ children, ...props }, forwardedRef) => {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const setMenuRef = useCallback(
    (menu: HTMLDetailsElement | null) => {
      menuRef.current = menu;
      if (typeof forwardedRef === "function") {
        forwardedRef(menu);
      } else if (forwardedRef) {
        forwardedRef.current = menu;
      }
    },
    [forwardedRef],
  );

  useEffect(() => {
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const menu = menuRef.current;
      if (
        !menu?.open ||
        !(event.target instanceof Node) ||
        menu.contains(event.target)
      ) {
        return;
      }

      menu.removeAttribute("open");
    };

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, []);

  return (
    <details ref={setMenuRef} {...props}>
      {children}
    </details>
  );
});

DetailsMenu.displayName = "DetailsMenu";

export { DetailsMenu };
