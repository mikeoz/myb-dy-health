import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useNavigate } from "react-router-dom";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Sticky mobile-friendly header */}
          <header className="sticky top-0 z-10 h-14 border-b border-border flex items-center px-4 bg-background">
            <SidebarTrigger className="mr-3" />
            <span className="font-semibold text-foreground md:hidden">MyBödy</span>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => navigate("/home")}
              aria-label="Go to home"
            >
              <Home className="h-5 w-5" />
            </Button>
          </header>
          
          {/* Main content area with responsive padding */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
