import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BookOpen, 
  Upload, 
  Clock, 
  Database, 
  Shield,
  Activity
} from "lucide-react";

/**
 * Home Page - Primary post-login landing
 * 
 * Mobile-first design with thumb-friendly action buttons.
 * 
 * GUARDRAIL: No PHI in logs
 * GUARDRAIL: No external APIs
 */
const Home = () => {
  const navigate = useNavigate();

  // Query data sources count for the status card
  const { data: sourcesCount, isLoading: isLoadingSources } = useQuery({
    queryKey: ["data-sources-count"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return null;
      
      const { count, error } = await supabase
        .from("data_sources")
        .select("*", { count: "exact", head: true })
        .eq("user_id", session.session.user.id);
      
      if (error) throw error;
      return count ?? 0;
    },
  });

  const actions = [
    {
      label: "Add a Journal Entry",
      icon: BookOpen,
      route: "/journal",
      variant: "default" as const,
    },
    {
      label: "Upload a Document",
      icon: Upload,
      route: "/documents",
      variant: "outline" as const,
    },
    {
      label: "View Timeline",
      icon: Clock,
      route: "/timeline",
      variant: "outline" as const,
    },
    {
      label: "Manage Sources",
      icon: Database,
      route: "/sources",
      variant: "outline" as const,
    },
    {
      label: "Review Consent",
      icon: Shield,
      route: "/consent",
      variant: "outline" as const,
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="max-w-md mx-auto space-y-6">
        {/* Welcome Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Welcome to MyBödy
          </h1>
          <p className="text-muted-foreground">
            What would you like to do today?
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {actions.map((action) => (
            <Button
              key={action.route}
              variant={action.variant}
              className="w-full h-12 text-base justify-start gap-3"
              onClick={() => navigate(action.route)}
            >
              <action.icon className="h-5 w-5" />
              {action.label}
            </Button>
          ))}
        </div>

        {/* Status Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {isLoadingSources
                ? "Loading..."
                : sourcesCount !== null
                ? `Sources connected: ${sourcesCount}`
                : "Sources connected: (not checked yet)"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Home;
