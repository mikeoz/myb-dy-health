import { 
  Clock, 
  FileText, 
  Link2, 
  Shield, 
  Settings, 
  Bug,
  BookOpen,
  Home
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const mainNavItems = [
  { title: "Home", url: "/home", icon: Home },
  { title: "Timeline", url: "/timeline", icon: Clock },
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Sources", url: "/sources", icon: Link2 },
  { title: "Consent", url: "/consent", icon: Shield },
];

const settingsNavItems = [
  { title: "Settings", url: "/settings", icon: Settings },
];

const devNavItems = [
  { title: "Admin / Debug", url: "/admin", icon: Bug },
  { title: "Guardrails", url: "/docs/guardrails", icon: BookOpen },
];

// Check if we're in development mode
const isDevMode = import.meta.env.VITE_APP_ENV === "development" || 
                  import.meta.env.DEV;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-sm">
            M
          </div>
          {!collapsed && (
            <span className="font-semibold text-sidebar-foreground">
              MyBödy
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Health Data</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink
                      to={item.url}
                      end
                      className="flex items-center gap-2"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Settings */}
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink
                      to={item.url}
                      end
                      className="flex items-center gap-2"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Developer Tools - Only shown in development mode */}
        {isDevMode && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground/60">Developer</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {devNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                    >
                      <NavLink
                        to={item.url}
                        end
                        className="flex items-center gap-2 text-muted-foreground"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 py-3">
          {!collapsed && (
            <p className="text-xs text-muted-foreground">
              v0.1.0 {isDevMode ? "— Development" : ""}
            </p>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
