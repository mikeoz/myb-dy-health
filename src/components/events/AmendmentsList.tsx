import { format } from "date-fns";
import { Clock, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Amendments List Component
 * 
 * Displays version history of amendments for an event.
 * 
 * GUARDRAIL: No PHI in logs - displays only, never logs content
 */

interface Amendment {
  id: string;
  event_type?: string;
  event_time: string;
  title: string | null;
  summary: string;
  details?: unknown;
  created_at: string;
}

interface AmendmentsListProps {
  amendments: Amendment[];
  onViewAmendment: (amendmentId: string) => void;
}

export function AmendmentsList({ amendments, onViewAmendment }: AmendmentsListProps) {
  if (!amendments || amendments.length === 0) return null;

  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        Version History ({amendments.length} amendment{amendments.length !== 1 ? "s" : ""})
      </h3>
      <div className="space-y-2">
        {amendments.map((amendment, index) => (
          <div 
            key={amendment.id}
            className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {index === 0 ? "Latest: " : ""}{amendment.title || "Untitled amendment"}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(amendment.event_time), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewAmendment(amendment.id)}
            >
              <Eye className="h-3 w-3 mr-1" />
              View
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
