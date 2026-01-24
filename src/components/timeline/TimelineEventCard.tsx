import { Clock, BookOpen, FileText, ExternalLink, Edit } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

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

interface TimelineEventCardProps {
  event: TimelineEvent;
  onViewDocument: (documentArtifactId: string) => void;
}

/**
 * Individual timeline event card component
 * 
 * GUARDRAIL: No PHI in logs - only displays, never logs content
 */
export function TimelineEventCard({ event, onViewDocument }: TimelineEventCardProps) {
  const navigate = useNavigate();
  const config = EVENT_TYPE_CONFIG[event.event_type] || {
    label: event.event_type,
    icon: Clock,
    color: "bg-secondary text-secondary-foreground",
  };
  const Icon = config.icon;
  const details = event.details as Record<string, unknown> | null;
  const isAmendment = event.event_type === "event_amended";

  const handleCardClick = () => {
    navigate(`/event/${event.id}`);
  };

  const handleViewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (details?.document_artifact_id) {
      onViewDocument(details.document_artifact_id as string);
    }
  };

  // For amendments, show the amended event type badge
  const amendedEventType = isAmendment && details?.amended_event_type;
  const amendedCategory = isAmendment && details?.category;

  return (
    <div 
      className="rounded-lg border border-border bg-card p-4 shadow-sm cursor-pointer hover:border-primary/30 hover:shadow-md transition-all"
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleCardClick()}
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
              {/* Journal category badge */}
              {event.event_type === "journal_entry" && details?.category && (
                <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  {CATEGORY_LABELS[String(details.category)] || String(details.category)}
                </span>
              )}
              {/* Document type badge */}
              {event.event_type === "document_uploaded" && details?.doc_type && (
                <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  {DOC_TYPE_LABELS[String(details.doc_type)] || String(details.doc_type)}
                </span>
              )}
              {/* Amendment badges */}
              {isAmendment && amendedEventType === "journal_entry" && (
                <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  Journal
                </span>
              )}
              {isAmendment && amendedEventType === "document_uploaded" && (
                <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  Document
                </span>
              )}
              {isAmendment && amendedCategory && (
                <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  {CATEGORY_LABELS[String(amendedCategory)] || String(amendedCategory)}
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
              onClick={handleViewClick}
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
}
