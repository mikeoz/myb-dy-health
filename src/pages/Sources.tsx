import { useState } from "react";
import { Link2, ExternalLink, Smartphone, Loader2, Plus, RefreshCw, AlertTriangle, Cloud } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { safeLog } from "@/lib/safe-logger";
import { createAuditEvent } from "@/lib/audit-helpers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

/**
 * Sources Page
 * 
 * Manage connections to external health data sources.
 * 
 * GUARDRAIL: Server-only secrets
 * - API keys for external sources are stored server-side only
 * - Client only sees connection status, never credentials
 * 
 * GUARDRAIL: Provenance is mandatory
 * - Data from external sources includes provenance (source, sync time)
 * 
 * GUARDRAIL: Asynchronous by default
 * - Data sync operations are modeled as async jobs
 */

interface DataSource {
  id: string;
  name: string;
  type: string;
  provider: string | null;
  status: string;
  connection_state: string;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_error_code: string | null;
  last_error_at: string | null;
  created_at: string;
}

const CONNECTION_STATE_STYLES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  disconnected: { label: "Disconnected", variant: "secondary" },
  connected: { label: "Connected", variant: "default" },
  error: { label: "Error", variant: "destructive" },
};

const SOURCE_TYPE_ICONS: Record<string, typeof Cloud> = {
  portal: ExternalLink,
  device: Smartphone,
  external_api: Cloud,
};

const Sources = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addingSource, setAddingSource] = useState<string | null>(null);

  const { data: sources, isLoading, error } = useQuery({
    queryKey: ["data-sources"],
    queryFn: async () => {
      safeLog.info("Fetching data sources", { action: "sources_fetch" });
      
      const { data, error } = await supabase
        .from("data_sources")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) {
        safeLog.error("Failed to fetch data sources", { 
          action: "sources_fetch_error",
          errorType: error.code 
        });
        throw error;
      }
      
      safeLog.info("Data sources fetched", { 
        action: "sources_fetch_success",
        count: data?.length ?? 0 
      });
      
      return data as DataSource[];
    },
  });

  const addSourceMutation = useMutation({
    mutationFn: async ({ type, name, provider }: { type: string; name: string; provider: string }) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");
      
      const userId = session.session.user.id;
      
      // Create the data source
      const { data: newSource, error: sourceError } = await supabase
        .from("data_sources")
        .insert({
          user_id: userId,
          type: type as "manual" | "upload" | "portal" | "external_api" | "device",
          name,
          provider,
          status: "pending",
          connection_state: "disconnected",
        })
        .select("id")
        .single();
      
      if (sourceError) throw sourceError;
      
      // Create audit event
      await supabase.from("audit_events").insert({
        user_id: userId,
        action: "source_added",
        entity_type: "data_source",
        entity_id: newSource.id,
      });
      
      safeLog.info("Data source added", {
        action: "source_added",
        id: newSource.id,
        resourceType: "data_source",
      });
      
      return newSource;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data-sources"] });
      toast({
        title: "Source added",
        description: "The data source has been added. Connect it to start syncing.",
      });
      setAddingSource(null);
    },
    onError: (error) => {
      safeLog.error("Failed to add data source", {
        action: "source_add_error",
        errorType: error instanceof Error ? error.name : "unknown",
      });
      toast({
        variant: "destructive",
        title: "Failed to add source",
        description: "Please try again.",
      });
      setAddingSource(null);
    },
  });

  const handleAddSource = (type: string, name: string, provider: string) => {
    setAddingSource(type);
    addSourceMutation.mutate({ type, name, provider });
  };

  // Filter out manual/upload sources from the list (those are for internal use)
  const externalSources = sources?.filter(s => 
    s.type === "portal" || s.type === "device" || s.type === "external_api"
  ) ?? [];
  const hasJournal = sources?.some(s => s.type === "manual") ?? false;
  const hasFastenSource = sources?.some(s => s.provider === "fasten") ?? false;

  if (isLoading) {
    return (
      <div className="page-container animate-fade-in">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Sources</h1>
          <p className="page-description">Connect to external health data providers</p>
        </div>
        <div className="empty-state">
          <AlertTriangle className="empty-state-icon text-destructive" />
          <h3 className="empty-state-title">Unable to load sources</h3>
          <p className="empty-state-description">Please sign in to view your data sources.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Sources</h1>
        <p className="page-description">Connect to external health data providers</p>
      </div>

      {externalSources.length === 0 ? (
        // Empty state with CTA cards
        <div className="space-y-6">
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add your first source
              </CardTitle>
              <CardDescription>
                Connect to healthcare providers to automatically import your health records.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-4"
                onClick={() => handleAddSource("external_api", "Patient-Authorized External Records (Demo)", "fasten")}
                disabled={addingSource === "external_api" || hasFastenSource}
              >
                {addingSource === "external_api" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Cloud className="h-5 w-5" />
                )}
                <div className="text-left">
                  <div className="font-medium">Fasten Health (Demo)</div>
                  <div className="text-xs text-muted-foreground">
                    {hasFastenSource 
                      ? "Already added" 
                      : "Patient-authorized external records demo"
                    }
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-4"
                onClick={() => handleAddSource("portal", "Patient Portal", "Epic/MyChart")}
                disabled={addingSource === "portal"}
              >
                {addingSource === "portal" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ExternalLink className="h-5 w-5" />
                )}
                <div className="text-left">
                  <div className="font-medium">Add Patient Portal (MyChart)</div>
                  <div className="text-xs text-muted-foreground">Coming soon — OAuth integration</div>
                </div>
              </Button>
              
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-4"
                onClick={() => handleAddSource("device", "Apple Health", "Apple Health")}
                disabled={addingSource === "device"}
              >
                {addingSource === "device" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Smartphone className="h-5 w-5" />
                )}
                <div className="text-left">
                  <div className="font-medium">Add Apple Health</div>
                  <div className="text-xs text-muted-foreground">Coming soon — Device sync</div>
                </div>
              </Button>
              
              <div className="pt-2 border-t">
                <div className="flex items-center gap-3 px-4 py-3 text-sm">
                  <Link2 className="h-5 w-5 text-primary" />
                  <div>
                    <div className="font-medium">Manual Journal</div>
                    <div className="text-xs text-muted-foreground">
                      {hasJournal ? "Active — You have journal entries" : "Start by adding a journal entry"}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" asChild className="ml-auto">
                    <Link to="/journal">Open</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        // List view
        <div className="space-y-4">
          {externalSources.map((source) => {
            const stateStyle = CONNECTION_STATE_STYLES[source.connection_state] || CONNECTION_STATE_STYLES.disconnected;
            
            return (
              <Link 
                key={source.id} 
                to={`/sources/${source.id}`}
                className="block"
              >
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0">
                        {(() => {
                          const IconComponent = SOURCE_TYPE_ICONS[source.type] || Cloud;
                          return <IconComponent className="h-6 w-6 text-muted-foreground" />;
                        })()}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium truncate">{source.name}</h3>
                          <Badge variant={stateStyle.variant}>{stateStyle.label}</Badge>
                          {source.provider === "fasten" && (
                            <Badge variant="outline" className="text-xs">Demo</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {source.provider === "fasten" 
                            ? "Patient-Authorized External Records" 
                            : (source.provider || source.type)
                          }
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {source.last_sync_at 
                            ? `Last synced ${format(new Date(source.last_sync_at), "MMM d, yyyy 'at' h:mm a")}`
                            : "Never synced"
                          }
                        </p>
                      </div>
                      
                      <div className="flex-shrink-0">
                        {source.connection_state === "disconnected" && (
                          <Button size="sm" variant="outline">
                            Connect
                          </Button>
                        )}
                        {source.connection_state === "connected" && (
                          <Button size="sm" variant="ghost">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        {source.connection_state === "error" && (
                          <Button size="sm" variant="destructive">
                            Retry
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
          
          {/* Add more sources */}
          <Card className="border-dashed">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                {!hasFastenSource && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleAddSource("external_api", "Patient-Authorized External Records (Demo)", "fasten")}
                    disabled={!!addingSource}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Fasten Demo
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleAddSource("portal", "Patient Portal", "Epic/MyChart")}
                  disabled={!!addingSource}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Patient Portal
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleAddSource("device", "Apple Health", "Apple Health")}
                  disabled={!!addingSource}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Apple Health
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Sources;
