import { useEffect, useMemo } from "react";
import { useRouter } from "next/router";

export const useUnsavedSettingsPrompt = (dirty: boolean) => {
  const router = useRouter();
  const cancellation = useMemo(
    () => Object.assign(new Error("Navigation cancelled"), { cancelled: true }),
    [],
  );
  // A cancelled route rejects asynchronously, sometimes after the field is
  // reset. Keep this handler for the form's lifetime, including while clean.
  useEffect(() => {
    const cancelledNavigation = (event: PromiseRejectionEvent | ErrorEvent) => {
      if (("reason" in event ? event.reason : event.error) !== cancellation)
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener("error", cancelledNavigation, true);
    window.addEventListener("unhandledrejection", cancelledNavigation, true);
    return () => {
      window.removeEventListener("error", cancelledNavigation, true);
      window.removeEventListener(
        "unhandledrejection",
        cancelledNavigation,
        true,
      );
    };
  }, [cancellation]);
  useEffect(() => {
    if (!dirty) return;
    const message = "Discard unsaved prompt changes?";
    const currentHistoryState: unknown = window.history.state;
    let leavingViaHistory = false;
    let signingOut = false;
    let followingLink = false;
    const beforeClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const signOut = event.target.closest("[data-settings-sign-out]");
      const link = event.target.closest("a[href]");
      const followsLink =
        link instanceof HTMLAnchorElement &&
        (!link.target || link.target === "_self") &&
        !link.hasAttribute("download") &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey &&
        link.href !== window.location.href;
      if (!signOut && !followsLink) return;
      if (window.confirm(message)) {
        signingOut = !!signOut;
        followingLink = followsLink;
      } else {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (signingOut || followingLink) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const routeChangeStart = (url: string) => {
      if (followingLink) {
        followingLink = false;
        return;
      }
      if (
        url === router.asPath ||
        signingOut ||
        leavingViaHistory ||
        window.confirm(message)
      )
        return;
      router.events.emit("routeChangeError", cancellation, url, {
        shallow: false,
      });
      throw cancellation;
    };
    router.beforePopState(() => {
      if (window.confirm(message)) {
        leavingViaHistory = true;
        return true;
      }
      window.history.pushState(currentHistoryState, "", router.asPath);
      return false;
    });
    document.addEventListener("click", beforeClick, true);
    window.addEventListener("beforeunload", beforeUnload);
    router.events.on("routeChangeStart", routeChangeStart);
    return () => {
      document.removeEventListener("click", beforeClick, true);
      window.removeEventListener("beforeunload", beforeUnload);
      router.events.off("routeChangeStart", routeChangeStart);
      router.beforePopState(() => true);
    };
  }, [dirty, router, cancellation]);
};
