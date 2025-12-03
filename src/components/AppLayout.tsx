import { SidebarProvider, SidebarTrigger } from "src/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { BottomNav } from "../views/BottomNav";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      {/* Sidebar only visible on desktop */}
      <div className="hidden md:block">
        <AppSidebar />
      </div>

      <main className="flex-1 w-full min-h-screen bg-background">
        <div className="p-4 pb-24 md:p-8 md:pb-8 w-full max-w-7xl mx-auto">
          {children}
        </div>

        {/* BottomNav only visible on mobile */}
        <div className="md:hidden">
          <BottomNav />
        </div>
      </main>
    </SidebarProvider>
  );
}

