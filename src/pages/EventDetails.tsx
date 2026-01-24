import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, BookOpen, FileText, Download, Edit, Loader2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { safeLog } from "@/lib/safe-logger";
import { 
  getDocumentArtifactId, 
  getAmendsEventId, 
  getAmendedEventType,
  getText,
  getDocType,
  getNotes,
  getOptionalCategory 
} from "@/lib/event-details";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AmendmentModal } from "@/components/events/AmendmentModal";
import { AmendmentsList } from "@/components/events/AmendmentsList";

/**
 * Event Details Page
 * 
 * Displays full details of a timeline event with amendment capability.
 * Shows "current view" if amendments exist.
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
  const documentArtifactId = event?.details ? getDocumentArtifactId(event.details) : null;
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

  // Fetch amendments for this event (ordered by event_time desc to get latest first)
  const { data: amendments, refetch: refetchAmendments } = useQuery({
    queryKey: ["event-amendments", id],
    queryFn: async () => {
      if (!id) return [];

      const { data, error } = await supabase
        .from("timeline_events")
        .select("id, event_type, event_time, title, summary, details, created_at")
        .eq("event_type", "event_amended")
        .order("event_time", { ascending: false });

      if (error) {
        safeLog.error("Failed to fetch amendments", { action: "amendments_fetch_error", errorType: error.code });
        return [];
      }

      // Filter to amendments that reference this event
      return (data || []).filter(
        (e) => getAmendsEventId(e.details) === id
      );
    },
    enabled: !!id,
  });

  // Get the latest amendment (first in the list since ordered desc)
  const latestAmendment = amendments && amendments.length > 0 ? amendments[0] : null;

  const handleViewDocument = async () => {
    const artifactId = documentArtifactId;
    if (!artifactId) {
      toast({
        variant: "destructive",
        title: "Unable to view document",
        description: "Document file not found.",
      });
      return;
    }

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
      const downloadUrl = `${supabaseUrl}/functions/v1/documents-download?artifact_id=${encodeURIComponent(artifactId)}`;
      
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
        action: "document_download_success",
        id: artifactId,
      });
    } catch (error) {
      safeLog.error("Failed to download document", {
        action: "document_download_error",
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
          <Button variant="ghost" onClick={() => navigate("/timeline")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Timeline
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
  const details = event.details;

  const isJournalEntry = event.event_type === "journal_entry";
  const isDocumentEvent = event.event_type === "document_uploaded";
  const isAmendment = event.event_type === "event_amended";
  const canAmend = isJournalEntry || isDocumentEvent;
  const hasAmendments = amendments && amendments.length > 0;

  // Extract values using safe helpers
  const category = getOptionalCategory(details);
  const docType = getDocType(details);
  const text = getText(details);
  const notes = getNotes(details);
  const amendsEventId = getAmendsEventId(details);
  const amendedEventType = getAmendedEventType(details);

  // Get current view values from latest amendment if available
  const currentViewText = latestAmendment ? getText(latestAmendment.details) : text;
  const currentViewCategory = latestAmendment ? getOptionalCategory(latestAmendment.details) : category;
  const currentViewTitle = latestAmendment ? latestAmendment.title?.replace("Amended: ", "") : event.title;
  const currentViewDocType = latestAmendment ? getDocType(latestAmendment.details) : docType;
  const currentViewNotes = latestAmendment ? getNotes(latestAmendment.details) : notes;

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
        <Button variant="ghost" onClick={() => navigate("/timeline")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Timeline
        </Button>
      </div>

      {/* Amendment banner for original events */}
      {hasAmendments && !isAmendment && (
        <div className="mb-4 rounded-lg border border-warning bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning-foreground flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-warning-foreground">This event has been amended</h3>
              <p className="text-sm text-muted-foreground mt-1">
                The content below shows the latest version from the most recent amendment.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => latestAmendment && navigate(`/event/${latestAmendment.id}`)}
              >
                View Latest Amendment
              </Button>
            </div>
          </div>
        </div>
      )}

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
              {isJournalEntry && currentViewCategory && (
                <span className="ml-2 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  {CATEGORY_LABELS[currentViewCategory] || currentViewCategory}
                </span>
              )}
              {isDocumentEvent && currentViewDocType && (
                <span className="ml-2 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  {DOC_TYPE_LABELS[currentViewDocType] || currentViewDocType}
                </span>
              )}
            </div>
          </div>
          <time className="text-sm text-muted-foreground">
            {format(new Date(event.event_time), "MMMM d, yyyy 'at' h:mm a")}
          </time>
        </div>

        {/* Title - show current view if amended */}
        <h1 className="text-xl font-semibold text-foreground mb-2">
          {currentViewTitle || "Untitled"}
        </h1>

        {/* Summary */}
        <p className="text-muted-foreground mb-4">
          {event.summary}
        </p>

        {/* Full content for journal entries - show current view */}
        {isJournalEntry && currentViewText && (
          <div className="bg-muted/50 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              {hasAmendments ? "Entry Text (Current Version)" : "Entry Text"}
            </h3>
            <p className="text-foreground whitespace-pre-wrap leading-relaxed">
              {currentViewText}
            </p>
          </div>
        )}

        {/* Document details - show current view */}
        {isDocumentEvent && artifact && (
          <div className="bg-muted/50 rounded-lg p-4 mb-4 space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              {hasAmendments ? "Document Details (Current Version)" : "Document Details"}
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Type:</span>
              <span className="text-foreground">
                {DOC_TYPE_LABELS[currentViewDocType || ""] || currentViewDocType || artifact.doc_type || "Unknown"}
              </span>
              
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
              <Download className="h-4 w-4 mr-2" />
              Open Document
            </Button>
          </div>
        )}

        {/* Notes if available - show current view */}
        {(currentViewNotes || notes) && (
          <div className="bg-muted/50 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Notes</h3>
            <p className="text-foreground">{currentViewNotes || notes}</p>
          </div>
        )}

        {/* Amendment reference */}
        {isAmendment && amendsEventId && (
          <div className="bg-warning/10 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium text-warning-foreground mb-2">This is an amendment</h3>
            <p className="text-sm text-muted-foreground mb-2">
              This event amends a previous {(amendedEventType || "event").replace(/_/g, " ")}.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/event/${amendsEventId}`)}
            >
              View Original Event
            </Button>
          </div>
        )}

        {/* Amendment text content */}
        {isAmendment && text && (
          <div className="bg-muted/50 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Amended Content</h3>
            <p className="text-foreground whitespace-pre-wrap leading-relaxed">
              {text}
            </p>
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

      {/* Version history section */}
      {hasAmendments && (
        <AmendmentsList 
          amendments={amendments} 
          onViewAmendment={(amendId) => navigate(`/event/${amendId}`)} 
        />
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
