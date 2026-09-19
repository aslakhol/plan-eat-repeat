import { DesktopNav } from "./DesktopNav";
import { BottomNav } from "../views/BottomNav";
import { useUser } from "@clerk/nextjs";
import { cn } from "src/lib/utils";
import { useState } from "react";
import { AddDinnerSheet } from "~/views/Dinners/AddDinnerSheet";
import {
  DinnerCreationContext,
  type DinnerCreationNavigation,
  type ImportedDinnerDraft,
} from "~/views/Dinners/DinnerCreationContext";
import { useRouter } from "next/router";
import { KeepScreenAwakeProvider } from "~/hooks/use-keep-screen-awake";
import { ShoppingItemCreationProvider } from "~/views/ShoppingList/ShoppingItemCreationContext";
import { HouseholdGate } from "./HouseholdGate";

// Public recipes and invitations must finish their own authentication flows
// before we create a household or show the welcome.
const householdOptionalPages = new Set([
  "/invite/[inviteId]",
  "/d/[publicSlug]",
  "/h/[publicSlug]",
  "/onboarding",
  "/system-admin/ai-import-spend",
]);

type LayoutProps = {
  children: React.ReactNode;
  contentClassName?: string;
  mobileNavigation?: boolean;
};

export function AppLayout(props: LayoutProps) {
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const layout = <Layout {...props} />;
  if (!isLoaded || !isSignedIn || householdOptionalPages.has(router.pathname)) {
    return layout;
  }
  return (
    <HouseholdGate key={user.id} userId={user.id}>
      {layout}
    </HouseholdGate>
  );
}

function Layout({
  children,
  contentClassName,
  mobileNavigation = true,
}: LayoutProps) {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const showNav = isLoaded && isSignedIn;
  const showMobileNavigation =
    mobileNavigation && showNav && router.pathname !== "/dinners/new";
  const [addDinnerOpen, setAddDinnerOpen] = useState(false);
  const [addDinnerNavigation, setAddDinnerNavigation] =
    useState<DinnerCreationNavigation>({ origin: "cookbook" });
  const [importedDraft, setImportedDraft] =
    useState<ImportedDinnerDraft | null>(null);

  const openAddDinner = (navigation: DinnerCreationNavigation) => {
    setAddDinnerNavigation(navigation);
    setAddDinnerOpen(true);
  };

  return (
    <KeepScreenAwakeProvider>
      <DinnerCreationContext.Provider
        value={{ importedDraft, openAddDinner, setImportedDraft }}
      >
        <ShoppingItemCreationProvider>
          <div className="bg-background flex min-h-screen w-full flex-col">
            {showNav && (
              <DesktopNav
                onAddDinner={() =>
                  openAddDinner({
                    origin: router.pathname === "/" ? "week" : "cookbook",
                  })
                }
              />
            )}
            <main className="w-full flex-1">
              <div
                className={cn(
                  "mx-auto w-full max-w-7xl p-4 md:p-8",
                  showMobileNavigation && "pb-24 md:pb-8",
                  contentClassName,
                )}
              >
                {children}
              </div>

              {showMobileNavigation && (
                <div className="md:hidden">
                  <BottomNav
                    onAddDinner={() =>
                      openAddDinner({
                        origin: router.pathname === "/" ? "week" : "cookbook",
                      })
                    }
                  />
                </div>
              )}
            </main>
          </div>

          {showNav && (
            <AddDinnerSheet
              open={addDinnerOpen}
              onOpenChange={setAddDinnerOpen}
              navigation={addDinnerNavigation}
            />
          )}
        </ShoppingItemCreationProvider>
      </DinnerCreationContext.Provider>
    </KeepScreenAwakeProvider>
  );
}
