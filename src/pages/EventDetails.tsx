import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, BookOpen, FileText, ExternalLink, Edit, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { safeLog } from "@/lib/safe-logger";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AmendmentModal } from "@/components/events/AmendmentModal";
import { AmendmentsList } from "@/components/events/AmendmentsList";

/**
 * Event Details Page
 * 
 * Displays full details of a timeline event with amendment capability.
 * 
 * GUARDRAIL: No PHI in logs - only log IDs and action types
 * GUARDRAIL: User isolation via RLS
 */

interface TimelineEvent {
  id: string;
  user_id: string;
  event_type: string;
  event_time: string;
  title: string | null;
  summary: string;
  details: Record<string, unknown> | null;
  created_at: string;
  provenance_id: string;
  consent_snapshot_id: string;
}

interface DocumentArtifact {
  id: string;
  title: string | null;
  doc_type: string | null;
  content_type: string;
  file_size: number | null;
  original_filename: string | null;
  storage_path: string;
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
    color: "bg-accent/10 text-accent-foreground" 
  },
  event_amended: { 
    label: "Amendment", 
    icon: Edit, 
    color: "bg-warning/10 text-warning-foreground" 
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  symptom: "Symptom",
  medication: "Medication",
  mood: "Mood",
  question: "Question",
  other: "Other",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  lab: "Lab Results",
  imaging: "Imaging",
  visit_summary: "Visit Summary",
  medication: "Medication",
  insurance: "Insurance",
  other: "Other",
};

const EventDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAmendModalOpen, setIsAmendModalOpen] = useState(false);

  // Fetch the event
  const { data: event, isLoading: eventLoading, error: eventError, refetch: refetchEvent } = useQuery({
    queryKey: ["event-details", id],
    queryFn: async () => {
      if (!id) throw new Error("No event ID provided");

      safeLog.info("Fetching event details", { action: "event_details_fetch", id });

      const { data, error } = await supabase
        .from("timeline_events")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        safeLog.error("Failed to fetch event", { action: "event_details_fetch_error", errorType: error.code });
        throw error;
      }

      return data as TimelineEvent;
    },
    enabled: !!id,
  });

  // Fetch document artifact if this is a document event
  const documentArtifactId = event?.details?.document_artifact_id as string | undefined;
  const { data: artifact } = useQuery({
    queryKey: ["document-artifact", documentArtifactId],
    queryFn: async () => {
      if (!documentArtifactId) return null;

      const { data, error } = await supabase
        .from("document_artifacts")
        .select("id, title, doc_type, content_type, file_size, original_filename, storage_path")
        .eq("id", documentArtifactId)
        .maybeSingle();

      if (error) {
        safeLog.error("Failed to fetch artifact", { action: "artifact_fetch_error", errorType: error.code });
        return null;
      }

      return data as DocumentArtifact;
    },
    enabled: !!documentArtifactId,
  });

  // Fetch amendments for this event
  const { data: amendments, refetch: refetchAmendments } = useQuery({
    queryKey: ["event-amendments", id],
    queryFn: async () => {
      if (!id) return [];

      const { data, error } = await supabase
        .from("timeline_events")
        .select("id, event_type, event_time, title, summary, details, created_at")
        .eq("event_type", "event_amended")
        .order("created_at", { ascending: false });

      if (error) {
        safeLog.error("Failed to fetch amendments", { action: "amendments_fetch_error", errorType: error.code });
        return [];
      }

      // Filter to amendments that reference this event
      return (data || []).filter(
        (e) => (e.details as Record<string, unknown>)?.amends_event_id === id
      );
    },
    enabled: !!id,
  });

  const handleViewDocument = async () => {
    if (!artifact?.storage_path) {
      toast({
        variant: "destructive",
        title: "Unable to view document",
        description: "Document file not found.",
      });
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(artifact.storage_path, 60 * 15);

      if (error) throw error;

      window.open(data.signedUrl, "_blank");
    } catch (error) {
      safeLog.error("Failed to create signed URL", {
        action: "signed_url_error",
        errorType: error instanceof Error ? error.name : "unknown",
      });
      toast({
        variant: "destructive",
        title: "Unable to view document",
        description: "Please try again.",
      });
    }
  };

  const handleAmendmentSuccess = () => {
    setIsAmendModalOpen(false);
    refetchEvent();
    refetchAmendments();
    toast({
      title: "Amendment saved",
      description: "Your amendment has been added to the timeline.",
    });
  };

  if (eventLoading) {
    return (
      <div className="page-container animate-fade-in">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (eventError || !event) {
    return (
      <div className="page-container animate-fade-in">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="empty-state">
          <Clock className="empty-state-icon text-destructive" />
          <h3 className="empty-state-title">Event not found</h3>
          <p className="empty-state-description">
            This event doesn't exist or you don't have access.
          </p>
        </div>
      </div>
    );
  }

  const config = EVENT_TYPE_CONFIG[event.event_type] || {
    label: event.event_type,
    icon: Clock,
    color: "bg-secondary text-secondary-foreground",
  };
  const Icon = config.icon;
  const details = event.details as Record<string, unknown> | null;

  const isJournalEntry = event.event_type === "journal_entry";
  const isDocumentEvent = event.event_type === "document_uploaded";
  const isAmendment = event.event_type === "event_amended";
  const canAmend = isJournalEntry || isDocumentEvent;

  // Format file size
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="page-container animate-fade-in">
      {/* Header with back button */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      {/* Main event card */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        {/* Type badge and date */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${config.color}`}>
                {config.label}
              </span>
              {/* Category or doc type badge */}
              {isJournalEntry && details?.category && (
                <span className="ml-2 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  {CATEGORY_LABELS[String(details.category)] || String(details.category)}
                </span>
              )}
              {isDocumentEvent && details?.doc_type && (
                <span className="ml-2 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  {DOC_TYPE_LABELS[String(details.doc_type)] || String(details.doc_type)}
                </span>
              )}
            </div>
          </div>
          <time className="text-sm text-muted-foreground">
            {format(new Date(event.event_time), "MMMM d, yyyy 'at' h:mm a")}
          </time>
        </div>

        {/* Title */}
        <h1 className="text-xl font-semibold text-foreground mb-2">
          {event.title || "Untitled"}
        </h1>

        {/* Summary */}
        <p className="text-muted-foreground mb-4">
          {event.summary}
        </p>

        {/* Full content for journal entries */}
        {isJournalEntry && details?.text && (
          <div className="bg-muted/50 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Entry Text</h3>
            <p className="text-foreground whitespace-pre-wrap">
              {String(details.text)}
            </p>
          </div>
        )}

        {/* Document details */}
        {isDocumentEvent && artifact && (
          <div className="bg-muted/50 rounded-lg p-4 mb-4 space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Document Details</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Type:</span>
              <span className="text-foreground">{DOC_TYPE_LABELS[artifact.doc_type || ""] || artifact.doc_type || "Unknown"}</span>
              
              <span className="text-muted-foreground">Format:</span>
              <span className="text-foreground">{artifact.content_type}</span>
              
              {artifact.file_size && (
                <>
                  <span className="text-muted-foreground">Size:</span>
                  <span className="text-foreground">{formatFileSize(artifact.file_size)}</span>
                </>
              )}
            </div>
            <Button onClick={handleViewDocument} className="mt-3">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Document
            </Button>
          </div>
        )}

        {/* Notes if available */}
        {details?.notes && (
          <div className="bg-muted/50 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Notes</h3>
            <p className="text-foreground">{String(details.notes)}</p>
          </div>
        )}

        {/* Amendment reference */}
        {isAmendment && details?.amends_event_id && (
          <div className="bg-warning/10 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium text-warning-foreground mb-2">This is an amendment</h3>
            <p className="text-sm text-muted-foreground mb-2">
              This event amends a previous {String(details.amended_event_type || "event").replace(/_/g, " ")}.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/event/${details.amends_event_id}`)}
            >
              View Original Event
            </Button>
          </div>
        )}

        {/* Amend button */}
        {canAmend && (
          <div className="pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setIsAmendModalOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              {isJournalEntry ? "Amend Entry" : "Amend Document Details"}
            </Button>
          </div>
        )}

        {/* Metadata footer */}
        <div className="mt-6 pt-4 border-t border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Record Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>
              <span className="font-medium">Event ID:</span>{" "}
              <span className="font-mono">{event.id.slice(0, 12)}...</span>
            </div>
            <div>
              <span className="font-medium">Provenance:</span>{" "}
              <span className="font-mono">{event.provenance_id.slice(0, 12)}...</span>
            </div>
            <div>
              <span className="font-medium">Consent Snapshot:</span>{" "}
              <span className="font-mono">{event.consent_snapshot_id.slice(0, 12)}...</span>
            </div>
            <div>
              <span className="font-medium">Created:</span>{" "}
              {format(new Date(event.created_at), "MMM d, yyyy h:mm a")}
            </div>
          </div>
        </div>
      </div>

      {/* Amendments section */}
      {amendments && amendments.length > 0 && (
        <AmendmentsList amendments={amendments} onViewAmendment={(amendId) => navigate(`/event/${amendId}`)} />
      )}

      {/* Amendment Modal */}
      <AmendmentModal
        isOpen={isAmendModalOpen}
        onClose={() => setIsAmendModalOpen(false)}
        onSuccess={handleAmendmentSuccess}
        event={event}
        eventType={event.event_type}
      />
    </div>
  );
};

export default EventDetails;
