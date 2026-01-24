import { Clock, Loader2, BookOpen, FileText, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { safeLog } from "@/lib/safe-logger";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

/**
 * Timeline Page
 * 
 * Displays health events in chronological order.
 * 
 * GUARDRAIL: Event-first data model
 * - All health-related information is stored as immutable events
 * - Events are displayed chronologically, never modified
 * 
 * GUARDRAIL: User isolation
 * - Users can only access their own timeline events (enforced by RLS)
 */

interface TimelineEvent {
  id: string;
  event_type: string;
  event_time: string;
  title: string | null;
  summary: string;
  details: Record<string, unknown> | null;
  created_at: string;
  provenance_id: string;
  consent_snapshot_id: string;
}

const EVENT_TYPE_CONFIG: Record<string, { 
  label: string; 
  icon: typeof Clock; 
  color: string;
}> = {
  journal_entry: { 
    label: "Journal Entry", 
    icon: BookOpen, 
    color: "bg-primary/10 text-primary" 
  },
  document_uploaded: { 
    label: "Document", 
    icon: FileText, 
    color: "bg-accent/10 text-accent" 
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  symptom: "Symptom",
  medication: "Medication",
  mood: "Mood",
  question: "Question",
  other: "Other",
};

const Timeline = () => {
  const { toast } = useToast();

  const { data: events, isLoading, error } = useQuery({
    queryKey: ["timeline-events"],
    queryFn: async () => {
      safeLog.info("Fetching timeline events", { action: "timeline_fetch" });
      
      const { data, error } = await supabase
        .from("timeline_events")
        .select("id, event_type, event_time, title, summary, details, created_at, provenance_id, consent_snapshot_id")
        .order("event_time", { ascending: false });
      
      if (error) {
        safeLog.error("Failed to fetch timeline events", { 
          action: "timeline_fetch_error",
          errorType: error.code 
        });
        throw error;
      }
      
      safeLog.info("Timeline events fetched", { 
        action: "timeline_fetch_success",
        count: data?.length ?? 0 
      });
      
      return data as TimelineEvent[];
    },
  });

  const handleViewDocument = async (documentArtifactId: string) => {
    try {
      // First get the document artifact to get the storage path
      const { data: artifact, error: artifactError } = await supabase
        .from("document_artifacts")
        .select("storage_path")
        .eq("id", documentArtifactId)
        .maybeSingle();

      if (artifactError || !artifact) {
        throw new Error("Document not found");
      }

      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(artifact.storage_path, 60 * 5);

      if (error) throw error;

      window.open(data.signedUrl, "_blank");
    } catch (error) {
      safeLog.error("Failed to view document from timeline", {
        action: "timeline_document_view_error",
        errorType: error instanceof Error ? error.name : "unknown",
      });
      toast({
        variant: "destructive",
        title: "Unable to view document",
        description: "Please try again.",
      });
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

  if (error) {
    return (
      <div className="page-container animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Timeline</h1>
          <p className="page-description">
            Your health events in chronological order
          </p>
        </div>
        <div className="empty-state">
          <Clock className="empty-state-icon text-destructive" />
          <h3 className="empty-state-title">Unable to load timeline</h3>
          <p className="empty-state-description">
            Please sign in to view your health timeline.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Timeline</h1>
        <p className="page-description">
          Your health events in chronological order
        </p>
      </div>

      {events?.length === 0 ? (
        <div className="empty-state">
          <Clock className="empty-state-icon" />
          <h3 className="empty-state-title">No events yet</h3>
          <p className="empty-state-description">
            Your health timeline will appear here as you add content.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Button asChild>
              <Link to="/journal">
                <BookOpen className="h-4 w-4 mr-2" />
                Add Journal Entry
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/documents">
                <FileText className="h-4 w-4 mr-2" />
                Upload Document
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {events?.map((event) => {
            const config = EVENT_TYPE_CONFIG[event.event_type] || {
              label: event.event_type,
              icon: Clock,
              color: "bg-secondary text-secondary-foreground",
            };
            const Icon = config.icon;
            const details = event.details as Record<string, unknown> | null;

            return (
              <div
                key={event.id}
                className="rounded-lg border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`p-2 rounded-lg ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}>
                          {config.label}
                        </span>
                        {event.event_type === "journal_entry" && details?.category && (
                          <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                            {CATEGORY_LABELS[String(details.category)] || String(details.category)}
                          </span>
                        )}
                      </div>
                      <h4 className="font-medium text-foreground">
                        {event.title || "Untitled"}
                      </h4>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {event.summary}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <time className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(event.event_time), "MMM d, yyyy")}
                    </time>
                    {event.event_type === "document_uploaded" && details?.document_artifact_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDocument(details.document_artifact_id as string)}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    )}
                  </div>
                </div>
                {/* Metadata footer - safe to display */}
                <div className="mt-3 flex gap-4 text-xs text-muted-foreground border-t border-border pt-2">
                  <span>ID: {event.id.slice(0, 8)}...</span>
                  <span>Provenance: {event.provenance_id.slice(0, 8)}...</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Timeline;
