import { SidebarProvider } from "src/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { BottomNav } from "../views/BottomNav";
import { useUser } from "@clerk/nextjs";
import { cn } from "src/lib/utils";
import { useState } from "react";
import { AddDinnerSheet } from "~/views/Dinners/AddDinnerSheet";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useUser();
  const showNav = isLoaded && isSignedIn;
  const [addDinnerOpen, setAddDinnerOpen] = useState(false);

  return (
    <SidebarProvider>
      {showNav && (
        <div className="hidden md:block">
          <AppSidebar onAddDinner={() => setAddDinnerOpen(true)} />
        </div>
      )}

      <main className="bg-background min-h-screen w-full flex-1">
        <div
          className={cn(
            "mx-auto w-full max-w-7xl p-4",
            showNav ? "pb-24 md:p-8 md:pb-8" : "md:p-8",
          )}
        >
          {children}
        </div>

        {showNav && (
          <div className="md:hidden">
            <BottomNav onAddDinner={() => setAddDinnerOpen(true)} />
          </div>
        )}
      </main>

      {showNav && (
        <AddDinnerSheet open={addDinnerOpen} onOpenChange={setAddDinnerOpen} />
      )}
    </SidebarProvider>
  );
}
