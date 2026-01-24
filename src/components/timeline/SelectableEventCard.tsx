import { Clock, BookOpen, FileText, GitBranch, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  getOptionalCategory,
  getDocType,
  getAmendsEventId,
  getAmendedEventType,
} from "@/lib/event-details";

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
    icon: GitBranch, 
    color: "bg-warning/10 text-warning-foreground" 
  },
  visit_summary: { 
    label: "Visit Summary", 
    icon: ClipboardList, 
    color: "bg-secondary text-secondary-foreground" 
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

interface SelectableEventCardProps {
  event: TimelineEvent;
  isSelected: boolean;
  onSelectionChange: (eventId: string, isSelected: boolean) => void;
  hasAmendments?: boolean;
}

/**
 * Event card with checkbox for review mode selection
 * 
 * GUARDRAIL: No PHI in logs - only displays, never logs content
 */
export function SelectableEventCard({ 
  event, 
  isSelected, 
  onSelectionChange,
  hasAmendments 
}: SelectableEventCardProps) {
  const config = EVENT_TYPE_CONFIG[event.event_type] || {
    label: event.event_type,
    icon: Clock,
    color: "bg-secondary text-secondary-foreground",
  };
  const Icon = config.icon;
  const details = event.details;
  const isAmendment = event.event_type === "event_amended";

  const category = getOptionalCategory(details);
  const docType = getDocType(details);
  const amendsEventId = getAmendsEventId(details);
  const amendedEventType = getAmendedEventType(details);
  const amendedCategory = isAmendment ? getOptionalCategory(details) : null;

  const handleCheckboxChange = (checked: boolean) => {
    onSelectionChange(event.id, checked);
  };

  return (
    <div 
      className={`rounded-lg border bg-card p-4 shadow-sm transition-all ${
        isSelected 
          ? "border-primary ring-2 ring-primary/20" 
          : "border-border hover:border-primary/30"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <div className="pt-1">
          <Checkbox
            checked={isSelected}
            onCheckedChange={handleCheckboxChange}
            aria-label={`Select ${event.title || "event"}`}
          />
        </div>

        {/* Icon */}
        <div className={`p-2 rounded-lg ${config.color} shrink-0`}>
          <Icon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}>
              {config.label}
            </span>
            {/* Journal category badge */}
            {event.event_type === "journal_entry" && category && (
              <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                {CATEGORY_LABELS[category] || category}
              </span>
            )}
            {/* Document type badge */}
            {event.event_type === "document_uploaded" && docType && (
              <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                {DOC_TYPE_LABELS[docType] || docType}
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
                {CATEGORY_LABELS[amendedCategory] || amendedCategory}
              </span>
            )}
            {/* Amended indicator */}
            {hasAmendments && !isAmendment && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning-foreground">
                <GitBranch className="h-3 w-3" />
                Amended
              </span>
            )}
          </div>
          <h4 className="font-medium text-foreground">
            {event.title || "Untitled"}
          </h4>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {event.summary}
          </p>
          {isAmendment && amendsEventId && (
            <p className="mt-1 text-xs text-muted-foreground">
              Amends: {amendsEventId.slice(0, 8)}...
            </p>
          )}
        </div>

        {/* Date */}
        <time className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
          {format(new Date(event.event_time), "MMM d, yyyy")}
        </time>
      </div>
    </div>
  );
}
