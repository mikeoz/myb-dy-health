import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, Lock, Clock, BookOpen, FileText, ClipboardList, GitBranch } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createAuditEvent } from "@/lib/audit-helpers";
import { 
  getOptionalCategory,
  getDocType,
} from "@/lib/event-details";

interface TimelineEvent {
  id: string;
  event_type: string;
  event_time: string;
  title: string | null;
  summary: string;
  details: Record<string, unknown> | null;
}

interface SharePreviewState {
  selectedEvents: TimelineEvent[];
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

/**
 * Share Preview Page
 * 
 * Read-only view of selected events for share preparation.
 * No data is sent or exported from this page.
 * 
 * GUARDRAIL: No external sharing - preparation only
 */
const SharePreview = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as SharePreviewState | null;

  const selectedEvents = state?.selectedEvents ?? [];

  // Calculate date range
  const dateRange = useMemo(() => {
    if (selectedEvents.length === 0) return null;
    const sortedDates = selectedEvents
      .map((e) => new Date(e.event_time).getTime())
      .sort((a, b) => a - b);
    return {
      start: new Date(sortedDates[0]),
      end: new Date(sortedDates[sortedDates.length - 1]),
    };
  }, [selectedEvents]);

  // Audit: share_preview_viewed
  useEffect(() => {
    if (selectedEvents.length > 0) {
      createAuditEvent(
        "share_preview_viewed",
        "timeline_selection",
        selectedEvents.map((e) => e.id).join(",").slice(0, 36) // Use first event ID as entity
      );
    }
  }, [selectedEvents]);

  if (selectedEvents.length === 0) {
    return (
      <div className="page-container animate-fade-in">
        <div className="empty-state">
          <Eye className="empty-state-icon" />
          <h3 className="empty-state-title">No events selected</h3>
          <p className="empty-state-description">
            Return to the timeline and select events in Review Mode to preview them for sharing.
          </p>
          <Button onClick={() => navigate("/timeline")} className="mt-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Timeline
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/timeline")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Timeline
        </Button>
        <h1 className="page-title flex items-center gap-2">
          <Eye className="h-6 w-6" />
          Share Preview
        </h1>
        <p className="page-description">
          Review your selected events before sharing
        </p>
      </div>

      {/* Read-only notice */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border mb-6">
        <div className="flex items-start gap-3">
          <Lock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">This is a read-only preview</p>
            <p className="text-sm text-muted-foreground mt-1">
              No data is sent unless you explicitly share later. 
              External sharing features are coming in a future update.
            </p>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-card rounded-lg border border-border">
          <p className="text-2xl font-bold text-foreground">{selectedEvents.length}</p>
          <p className="text-sm text-muted-foreground">
            Event{selectedEvents.length !== 1 ? "s" : ""} selected
          </p>
        </div>
        {dateRange && (
          <div className="p-4 bg-card rounded-lg border border-border">
            <p className="text-sm font-medium text-foreground">
              {format(dateRange.start, "MMM d, yyyy")}
            </p>
            {dateRange.start.getTime() !== dateRange.end.getTime() && (
              <p className="text-sm text-muted-foreground">
                to {format(dateRange.end, "MMM d, yyyy")}
              </p>
            )}
            {dateRange.start.getTime() === dateRange.end.getTime() && (
              <p className="text-sm text-muted-foreground">Single day</p>
            )}
          </div>
        )}
      </div>

      {/* Event list */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Selected Events</h2>
        {selectedEvents.map((event) => {
          const config = EVENT_TYPE_CONFIG[event.event_type] || {
            label: event.event_type,
            icon: Clock,
            color: "bg-secondary text-secondary-foreground",
          };
          const Icon = config.icon;
          const category = getOptionalCategory(event.details);
          const docType = getDocType(event.details);

          return (
            <div
              key={event.id}
              className="p-4 bg-card rounded-lg border border-border"
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${config.color} shrink-0`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge variant="secondary" className={config.color}>
                      {config.label}
                    </Badge>
                    {event.event_type === "journal_entry" && category && (
                      <Badge variant="outline">
                        {CATEGORY_LABELS[category] || category}
                      </Badge>
                    )}
                    {event.event_type === "document_uploaded" && docType && (
                      <Badge variant="outline">
                        {DOC_TYPE_LABELS[docType] || docType}
                      </Badge>
                    )}
                  </div>
                  <h4 className="font-medium text-foreground">
                    {event.title || "Untitled"}
                  </h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {event.summary}
                  </p>
                </div>
                <time className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {format(new Date(event.event_time), "MMM d, yyyy")}
                </time>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SharePreview;
