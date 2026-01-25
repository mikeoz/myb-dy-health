import { useState, useMemo, useEffect, useCallback } from "react";
import { Clock, Loader2, BookOpen, FileText, Cloud } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { safeLog } from "@/lib/safe-logger";
import { getAmendsEventId } from "@/lib/event-details";
import { createAuditEvent } from "@/lib/audit-helpers";
import { 
  requireUserId, 
  getOrCreateDataSource, 
  getOrCreateDefaultConsentSnapshot 
} from "@/lib/write-helpers";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { TimelineFilters, type FilterValue } from "@/components/timeline/TimelineFilters";
import { TimelineEventCard } from "@/components/timeline/TimelineEventCard";
import { ReviewModeToggle } from "@/components/timeline/ReviewModeToggle";
import { ReviewModeActions } from "@/components/timeline/ReviewModeActions";
import { SelectableEventCard } from "@/components/timeline/SelectableEventCard";
import { VisitSummaryModal } from "@/components/timeline/VisitSummaryModal";

/**
 * Timeline Page
 * 
 * Displays health events in chronological order.
 * Supports Review Mode for selecting events to create visit summaries.
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

const Timeline = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterValue>("all");
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [showSummaryModal, setShowSummaryModal] = useState(false);

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

  // Build a set of event IDs that have amendments
  const amendedEventIds = useMemo(() => {
    if (!events) return new Set<string>();
    
    const ids = new Set<string>();
    for (const event of events) {
      if (event.event_type === "event_amended") {
        const amendsId = getAmendsEventId(event.details);
        if (amendsId) {
          ids.add(amendsId);
        }
      }
    }
    return ids;
  }, [events]);

  // Filter events client-side
  const filteredEvents = useMemo(() => {
    if (!events) return [];
    
    switch (filter) {
      case "journal":
        return events.filter((e) => e.event_type === "journal_entry");
      case "documents":
        return events.filter((e) => e.event_type === "document_uploaded");
      case "external":
        return events.filter((e) => e.event_type === "external_event");
      default:
        return events;
    }
  }, [events, filter]);

  // Get selected events as full objects
  const selectedEvents = useMemo(() => {
    if (!events) return [];
    return events.filter((e) => selectedEventIds.has(e.id));
  }, [events, selectedEventIds]);

  // Audit: review_started when entering review mode
  useEffect(() => {
    if (isReviewMode) {
      createAuditEvent("review_started", "timeline", "timeline_review");
    }
  }, [isReviewMode]);

  // Clear selection when exiting review mode
  useEffect(() => {
    if (!isReviewMode) {
      setSelectedEventIds(new Set());
    }
  }, [isReviewMode]);

  const handleSelectionChange = useCallback((eventId: string, isSelected: boolean) => {
    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      if (isSelected) {
        next.add(eventId);
      } else {
        next.delete(eventId);
      }
      return next;
    });
  }, []);

  const handleCreateSummary = async (data: {
    title: string;
    summary: string;
    label: string;
    eventIds: string[];
    dateRange: { start: string; end: string };
  }) => {
    try {
      const userId = await requireUserId();
      const dataSourceId = await getOrCreateDataSource(userId, "manual", "User Curated");
      const consentSnapshotId = await getOrCreateDefaultConsentSnapshot(userId);

      // Create provenance
      const { data: provenance, error: provError } = await supabase
        .from("provenance")
        .insert({
          data_source_id: dataSourceId,
          method: "manual_entry",
        })
        .select("id")
        .single();

      if (provError) throw provError;

      // Create visit_summary event
      const { data: newEvent, error: eventError } = await supabase
        .from("timeline_events")
        .insert({
          user_id: userId,
          event_type: "visit_summary",
          event_time: new Date().toISOString(),
          title: data.title,
          summary: data.summary,
          provenance_id: provenance.id,
          consent_snapshot_id: consentSnapshotId,
          details: {
            referenced_event_ids: data.eventIds,
            date_range_start: data.dateRange.start,
            date_range_end: data.dateRange.end,
            label: data.label || null,
          },
        })
        .select("id")
        .single();

      if (eventError) throw eventError;

      // Audit: visit_summary_created
      await createAuditEvent("visit_summary_created", "timeline_event", newEvent.id);

      toast({
        title: "Visit Summary Created",
        description: "Your summary has been added to the timeline.",
      });

      // Refresh timeline and exit review mode
      queryClient.invalidateQueries({ queryKey: ["timeline-events"] });
      setIsReviewMode(false);
      setSelectedEventIds(new Set());

      safeLog.info("Visit summary created", {
        action: "visit_summary_created",
        id: newEvent.id,
        count: data.eventIds.length,
      });
    } catch (err) {
      safeLog.error("Failed to create visit summary", {
        action: "visit_summary_error",
        errorType: err instanceof Error ? err.name : "unknown",
      });
      toast({
        variant: "destructive",
        title: "Failed to create summary",
        description: "Please try again.",
      });
    }
  };

  const handlePreviewShare = () => {
    navigate("/share-preview", { state: { selectedEvents } });
  };

  const handleViewDocument = async (documentArtifactId: string) => {
    try {
      // Get current session for auth header
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast({
          variant: "destructive",
          title: "Not authenticated",
          description: "Please sign in to download documents.",
        });
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const downloadUrl = `${supabaseUrl}/functions/v1/documents-download?artifact_id=${encodeURIComponent(documentArtifactId)}`;
      
      // Use fetch to download with auth header, then trigger browser download
      const response = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      // Get filename from Content-Disposition header if available
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "document";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) {
          filename = match[1];
        }
      }

      // Create blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      safeLog.info("Document downloaded", {
        action: "timeline_document_download_success",
        id: documentArtifactId,
      });
    } catch (error) {
      safeLog.error("Failed to download document from timeline", {
        action: "timeline_document_download_error",
        errorType: error instanceof Error ? error.name : "unknown",
      });
      toast({
        variant: "destructive",
        title: "Unable to download document",
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

  // Determine empty state based on filter
  const renderEmptyState = () => {
    if (filter === "journal") {
      return (
        <div className="empty-state">
          <BookOpen className="empty-state-icon" />
          <h3 className="empty-state-title">No journal entries</h3>
          <p className="empty-state-description">
            Start tracking your health by adding a journal entry.
          </p>
          <Button asChild className="mt-6">
            <Link to="/journal">
              <BookOpen className="h-4 w-4 mr-2" />
              Add Journal Entry
            </Link>
          </Button>
        </div>
      );
    }
    
    if (filter === "documents") {
      return (
        <div className="empty-state">
          <FileText className="empty-state-icon" />
          <h3 className="empty-state-title">No documents</h3>
          <p className="empty-state-description">
            Upload your medical documents to keep them organized.
          </p>
          <Button asChild className="mt-6">
            <Link to="/documents">
              <FileText className="h-4 w-4 mr-2" />
              Upload Document
            </Link>
          </Button>
        </div>
      );
    }

    if (filter === "external") {
      return (
        <div className="empty-state">
          <Cloud className="empty-state-icon" />
          <h3 className="empty-state-title">No external records</h3>
          <p className="empty-state-description">
            Connect an external source to import health records.
          </p>
          <Button asChild className="mt-6">
            <Link to="/sources">
              <Cloud className="h-4 w-4 mr-2" />
              Manage Sources
            </Link>
          </Button>
        </div>
      );
    }

    // "All" filter empty state
    return (
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
    );
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Timeline</h1>
        <p className="page-description">
          Your health events in chronological order
        </p>
      </div>

      {/* Review mode toggle */}
      <ReviewModeToggle 
        isReviewMode={isReviewMode} 
        onToggle={setIsReviewMode} 
      />

      {/* Review mode actions */}
      {isReviewMode && (
        <ReviewModeActions
          selectedCount={selectedEventIds.size}
          onCreateSummary={() => setShowSummaryModal(true)}
          onPreviewShare={handlePreviewShare}
        />
      )}

      {/* Filter controls */}
      <TimelineFilters value={filter} onChange={setFilter} />

      {filteredEvents.length === 0 ? (
        renderEmptyState()
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((event) =>
            isReviewMode ? (
              <SelectableEventCard
                key={event.id}
                event={event}
                isSelected={selectedEventIds.has(event.id)}
                onSelectionChange={handleSelectionChange}
                hasAmendments={amendedEventIds.has(event.id)}
              />
            ) : (
              <TimelineEventCard
                key={event.id}
                event={event}
                onViewDocument={handleViewDocument}
                hasAmendments={amendedEventIds.has(event.id)}
              />
            )
          )}
        </div>
      )}

      {/* Visit Summary Modal */}
      <VisitSummaryModal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        selectedEvents={selectedEvents}
        onCreateSummary={handleCreateSummary}
      />
    </div>
  );
};

export default Timeline;
