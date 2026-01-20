import { Clock, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { safeLog } from "@/lib/safe-logger";
import { format } from "date-fns";

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
const Timeline = () => {
  const { data: events, isLoading, error } = useQuery({
    queryKey: ["timeline-events"],
    queryFn: async () => {
      safeLog.info("Fetching timeline events", { action: "timeline_fetch" });
      
      const { data, error } = await supabase
        .from("timeline_events")
        .select("id, event_type, event_time, summary, created_at, provenance_id, consent_snapshot_id")
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
      
      return data ?? [];
    },
  });

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

      {events.length === 0 ? (
        <div className="empty-state">
          <Clock className="empty-state-icon" />
          <h3 className="empty-state-title">No events yet</h3>
          <p className="empty-state-description">
            Your health timeline will appear here as you add documents and connect sources.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <div
              key={event.id}
              className="rounded-lg border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-block rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                    {event.event_type}
                  </span>
                  <p className="mt-2 text-sm text-foreground">{event.summary}</p>
                </div>
                <time className="text-xs text-muted-foreground">
                  {format(new Date(event.event_time), "MMM d, yyyy")}
                </time>
              </div>
              {/* Metadata footer - safe to display */}
              <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                <span>ID: {event.id.slice(0, 8)}...</span>
                <span>Provenance: {event.provenance_id.slice(0, 8)}...</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Timeline;
