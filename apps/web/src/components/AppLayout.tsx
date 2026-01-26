import { SidebarProvider } from "src/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { BottomNav } from "../views/BottomNav";
import { useUser } from "@clerk/nextjs";
import { cn } from "src/lib/utils";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useUser();
  const showNav = isLoaded && isSignedIn;

  return (
    <SidebarProvider>
      {showNav && (
        <div className="hidden md:block">
          <AppSidebar />
        </div>
      )}

      <main className="min-h-screen w-full flex-1 bg-background">
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
            <BottomNav />
          </div>
        )}
      </main>
    </SidebarProvider>
  );
}
