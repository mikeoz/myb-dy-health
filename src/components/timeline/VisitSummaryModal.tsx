import { useState } from "react";
import { format } from "date-fns";
import { ClipboardList, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface TimelineEvent {
  id: string;
  event_type: string;
  event_time: string;
  title: string | null;
  summary: string;
}

const PRESET_LABELS = [
  "For cardiology visit",
  "Medication discussion",
  "Recent symptoms",
  "Pre-op review",
  "Follow-up care",
];

interface VisitSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEvents: TimelineEvent[];
  onCreateSummary: (data: {
    title: string;
    summary: string;
    label: string;
    eventIds: string[];
    dateRange: { start: string; end: string };
  }) => Promise<void>;
}

/**
 * Modal for creating a visit summary from selected events
 */
export function VisitSummaryModal({
  isOpen,
  onClose,
  selectedEvents,
  onCreateSummary,
}: VisitSummaryModalProps) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [label, setLabel] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate date range
  const sortedDates = selectedEvents
    .map((e) => new Date(e.event_time).getTime())
    .sort((a, b) => a - b);
  const startDate = sortedDates.length > 0 ? new Date(sortedDates[0]) : new Date();
  const endDate = sortedDates.length > 0 ? new Date(sortedDates[sortedDates.length - 1]) : new Date();

  const handleSubmit = async () => {
    if (!title.trim() || !summary.trim()) return;

    setIsSubmitting(true);
    try {
      await onCreateSummary({
        title: title.trim(),
        summary: summary.trim(),
        label: label === "custom" ? customLabel.trim() : label,
        eventIds: selectedEvents.map((e) => e.id),
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      });
      // Reset form
      setTitle("");
      setSummary("");
      setLabel("");
      setCustomLabel("");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLabelSelect = (selectedLabel: string) => {
    if (label === selectedLabel) {
      setLabel("");
    } else {
      setLabel(selectedLabel);
      if (selectedLabel !== "custom") {
        setCustomLabel("");
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Create Visit Summary
          </DialogTitle>
          <DialogDescription>
            Create a summary of {selectedEvents.length} selected event
            {selectedEvents.length !== 1 ? "s" : ""} for sharing with a clinician or caregiver.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date range info */}
          <div className="p-3 bg-muted/50 rounded-lg text-sm">
            <span className="font-medium">Date range:</span>{" "}
            {format(startDate, "MMM d, yyyy")}
            {startDate.getTime() !== endDate.getTime() && (
              <> — {format(endDate, "MMM d, yyyy")}</>
            )}
            <span className="text-muted-foreground ml-2">
              ({selectedEvents.length} event{selectedEvents.length !== 1 ? "s" : ""})
            </span>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="summary-title">Title *</Label>
            <Input
              id="summary-title"
              placeholder="e.g., Cardiology Visit Prep"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* Summary text */}
          <div className="space-y-2">
            <Label htmlFor="summary-text">Summary *</Label>
            <Textarea
              id="summary-text"
              placeholder="Describe what this summary covers..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {summary.length}/500
            </p>
          </div>

          {/* Labels */}
          <div className="space-y-2">
            <Label>Label (optional)</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_LABELS.map((preset) => (
                <Badge
                  key={preset}
                  variant={label === preset ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/10"
                  onClick={() => handleLabelSelect(preset)}
                >
                  {preset}
                </Badge>
              ))}
              <Badge
                variant={label === "custom" ? "default" : "outline"}
                className="cursor-pointer hover:bg-primary/10"
                onClick={() => handleLabelSelect("custom")}
              >
                Custom...
              </Badge>
            </div>
            {label === "custom" && (
              <Input
                placeholder="Enter custom label"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                maxLength={50}
                className="mt-2"
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || !summary.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Summary"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
