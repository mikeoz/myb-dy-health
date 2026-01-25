import { ArrowLeft, ExternalLink, Smartphone, Loader2, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Cloud } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { safeLog } from "@/lib/safe-logger";
import { createAuditEvent } from "@/lib/audit-helpers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

/**
 * Source Details Page
 * 
 * Display and manage a single data source connection.
 * 
 * GUARDRAIL: User isolation
 * - RLS ensures users can only see their own sources
 * 
 * GUARDRAIL: Asynchronous by default
 * - Sync operations create jobs, not immediate execution
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

const SYNC_STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  ok: CheckCircle2,
  error: XCircle,
  never: AlertTriangle,
};

const SourceDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: source, isLoading, error } = useQuery({
    queryKey: ["data-source", id],
    queryFn: async () => {
      if (!id) throw new Error("No source ID provided");
      
      safeLog.info("Fetching source details", { action: "source_fetch", id });
      
      const { data, error } = await supabase
        .from("data_sources")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      
      if (error) {
        safeLog.error("Failed to fetch source", { 
          action: "source_fetch_error",
          errorType: error.code 
        });
        throw error;
      }
      
      if (!data) {
        throw new Error("Source not found");
      }
      
      return data as DataSource;
    },
    enabled: !!id,
  });

  // Fasten-specific sync mutation (calls edge function)
  const fastenSyncMutation = useMutation({
    mutationFn: async () => {
      if (!source) throw new Error("No source loaded");
      
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");
      
      // Log audit event
      await createAuditEvent("external_sync_requested", "data_source", source.id);
      
      safeLog.info("Fasten sync requested", {
        action: "external_sync_requested",
        id: source.id,
      });
      
      // Call the edge function for demo sync
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/fasten-demo-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({ source_id: source.id }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Sync failed");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["data-source", id] });
      queryClient.invalidateQueries({ queryKey: ["data-sources"] });
      queryClient.invalidateQueries({ queryKey: ["timeline-events"] });
      
      toast({
        title: "Demo sync complete",
        description: `Imported ${data.imported_count} external health records.`,
      });
    },
    onError: (error) => {
      safeLog.error("Fasten sync failed", {
        action: "external_sync_error",
        errorType: error instanceof Error ? error.name : "unknown",
      });
      toast({
        variant: "destructive",
        title: "Sync failed",
        description: "Please try again.",
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (action: "connect" | "sync" | "retry") => {
      if (!source) throw new Error("No source loaded");
      
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");
      
      const userId = session.session.user.id;
      
      // Insert job for sync request
      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .insert({
          user_id: userId,
          job_type: "source_sync_requested",
          status: "pending",
          idempotency_key: `${source.id}-${action}-${Date.now()}`,
          payload: {
            source_id: source.id,
            action,
            requested_at: new Date().toISOString(),
          },
        })
        .select("id")
        .single();
      
      if (jobError) throw jobError;
      
      // Update connection state if connecting
      if (action === "connect") {
        const { error: updateError } = await supabase
          .from("data_sources")
          .update({ connection_state: "connected" })
          .eq("id", source.id);
        
        if (updateError) throw updateError;
      }
      
      // Create audit event
      await supabase.from("audit_events").insert({
        user_id: userId,
        action: "source_sync_requested",
        entity_type: "data_source",
        entity_id: source.id,
      });
      
      safeLog.info("Sync requested", {
        action: "source_sync_requested",
        id: source.id,
        jobId: job.id,
        syncAction: action,
      });
      
      return job;
    },
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ["data-source", id] });
      queryClient.invalidateQueries({ queryKey: ["data-sources"] });
      
      const messages: Record<string, string> = {
        connect: "Source connected. Sync will run in a future build.",
        sync: "Sync requested. This will run in the background in a future build.",
        retry: "Retry requested. This will run in the background in a future build.",
      };
      
      toast({
        title: action === "connect" ? "Source connected" : "Sync requested",
        description: messages[action],
      });
    },
    onError: (error) => {
      safeLog.error("Sync request failed", {
        action: "source_sync_error",
        errorType: error instanceof Error ? error.name : "unknown",
      });
      toast({
        variant: "destructive",
        title: "Action failed",
        description: "Please try again.",
      });
    },
  });

  const isFastenSource = source?.provider === "fasten";
  const isPending = isFastenSource ? fastenSyncMutation.isPending : syncMutation.isPending;

  const handleAction = () => {
    if (!source) return;
    
    // For Fasten sources, use the dedicated sync function
    if (isFastenSource) {
      fastenSyncMutation.mutate();
      return;
    }
    
    // For other sources, use the job-based pattern
    switch (source.connection_state) {
      case "disconnected":
        syncMutation.mutate("connect");
        break;
      case "connected":
        syncMutation.mutate("sync");
        break;
      case "error":
        syncMutation.mutate("retry");
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="page-container animate-fade-in">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !source) {
    return (
      <div className="page-container animate-fade-in">
        <Button variant="ghost" onClick={() => navigate("/sources")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Sources
        </Button>
        <div className="empty-state">
          <AlertTriangle className="empty-state-icon text-destructive" />
          <h3 className="empty-state-title">Source not found</h3>
          <p className="empty-state-description">
            This source doesn't exist or you don't have access to it.
          </p>
        </div>
      </div>
    );
  }

  const stateStyle = CONNECTION_STATE_STYLES[source.connection_state] || CONNECTION_STATE_STYLES.disconnected;
  const SyncStatusIcon = source.last_sync_status ? SYNC_STATUS_ICONS[source.last_sync_status] : SYNC_STATUS_ICONS.never;

  return (
    <div className="page-container animate-fade-in">
      <Button variant="ghost" onClick={() => navigate("/sources")} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Sources
      </Button>

      <div className="space-y-6">
        {/* Fasten Demo Banner */}
        {isFastenSource && (
          <Alert>
            <Cloud className="h-4 w-4" />
            <AlertTitle>Patient-Authorized External Records (Demo)</AlertTitle>
            <AlertDescription>
              This is a demonstration of external health record import via Fasten Health. 
              Syncing will create sample timeline events to show how external records appear.
            </AlertDescription>
          </Alert>
        )}

        {/* Header Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 p-3 rounded-lg bg-muted">
                {source.type === "portal" ? (
                  <ExternalLink className="h-6 w-6" />
                ) : source.type === "external_api" ? (
                  <Cloud className="h-6 w-6" />
                ) : (
                  <Smartphone className="h-6 w-6" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle>{source.name}</CardTitle>
                  <Badge variant={stateStyle.variant}>{stateStyle.label}</Badge>
                  {isFastenSource && <Badge variant="outline">Demo</Badge>}
                </div>
                <CardDescription className="mt-1">
                  {isFastenSource 
                    ? `Fasten Health Demo • Added ${format(new Date(source.created_at), "MMM d, yyyy")}`
                    : `${source.provider || source.type} • Added ${format(new Date(source.created_at), "MMM d, yyyy")}`
                  }
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleAction} 
              disabled={isPending}
              variant={source.connection_state === "error" ? "destructive" : "default"}
              className="w-full sm:w-auto"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isFastenSource ? "Syncing..." : "Processing..."}
                </>
              ) : isFastenSource ? (
                source.connection_state === "connected" ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync Demo Data
                  </>
                ) : (
                  "Connect & Sync Demo"
                )
              ) : source.connection_state === "disconnected" ? (
                "Connect"
              ) : source.connection_state === "error" ? (
                "Retry"
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync now
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Activity Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sync Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <SyncStatusIcon className={`h-5 w-5 ${
                source.last_sync_status === "ok" ? "text-green-600" :
                source.last_sync_status === "error" ? "text-destructive" :
                "text-muted-foreground"
              }`} />
              <div>
                <div className="font-medium">
                  {source.last_sync_status === "ok" && "Last sync successful"}
                  {source.last_sync_status === "error" && "Last sync failed"}
                  {!source.last_sync_status && "Never synced"}
                </div>
                {source.last_sync_at && (
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(source.last_sync_at), "MMM d, yyyy 'at' h:mm a")}
                  </div>
                )}
              </div>
            </div>

            {source.last_error_code && source.last_error_at && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="text-sm font-medium text-destructive">
                  Error: {source.last_error_code}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {format(new Date(source.last_error_at), "MMM d, yyyy 'at' h:mm a")}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">About this source</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              {source.type === "external_api" && source.provider === "fasten" && (
                "This is a patient-authorized external records demo using Fasten Health. " +
                "Synced data appears as immutable timeline events with full provenance tracking."
              )}
              {source.type === "portal" && (
                "Patient portal connections allow you to import medical records directly from your healthcare provider's system."
              )}
              {source.type === "device" && (
                "Device connections sync health data from wearables and health apps on your phone."
              )}
            </p>
            {!isFastenSource && (
              <p className="text-xs">
                Note: External integrations are coming in a future release. For now, sources are placeholders for upcoming features.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SourceDetails;
