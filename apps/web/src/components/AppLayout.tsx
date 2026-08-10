import { SidebarProvider } from "src/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
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

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const showNav = isLoaded && isSignedIn;
  const showMobileNavigation = showNav && router.pathname !== "/dinners/new";
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
    <DinnerCreationContext.Provider
      value={{ importedDraft, openAddDinner, setImportedDraft }}
    >
      <SidebarProvider>
        {showNav && (
          <div className="hidden md:block">
            <AppSidebar
              onAddDinner={() =>
                openAddDinner({
                  origin: router.pathname === "/" ? "week" : "cookbook",
                })
              }
            />
          </div>
        )}

        <main className="bg-background min-h-screen w-full flex-1">
          <div
            className={cn(
              "mx-auto w-full max-w-7xl p-4 md:p-8",
              showMobileNavigation && "pb-24 md:pb-8",
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

        {showNav && (
          <AddDinnerSheet
            open={addDinnerOpen}
            onOpenChange={setAddDinnerOpen}
            navigation={addDinnerNavigation}
          />
        )}
      </SidebarProvider>
    </DinnerCreationContext.Provider>
  );
}
