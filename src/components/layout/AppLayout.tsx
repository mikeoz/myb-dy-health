import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          {/* Header with sidebar trigger */}
          <header className="h-14 border-b border-border flex items-center px-4 bg-background">
            <SidebarTrigger className="mr-4" />
            <div className="flex-1" />
            {/* TODO: Add user menu, notifications, etc. */}
          </header>
          
          {/* Main content area */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
