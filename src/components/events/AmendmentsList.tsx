import { Edit } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

/**
 * Amendments List Component
 * 
 * Displays a list of amendments for an event.
 */

interface Amendment {
  id: string;
  event_time: string;
  title: string | null;
  summary: string;
  created_at: string;
}

interface AmendmentsListProps {
  amendments: Amendment[];
  onViewAmendment: (amendmentId: string) => void;
}

export function AmendmentsList({ amendments, onViewAmendment }: AmendmentsListProps) {
  if (amendments.length === 0) return null;

  return (
    <div className="mt-6 rounded-lg border border-warning/30 bg-warning/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Edit className="h-4 w-4 text-warning-foreground" />
        <h3 className="font-medium text-warning-foreground">
          This event has {amendments.length} amendment{amendments.length > 1 ? "s" : ""}
        </h3>
      </div>
      <div className="space-y-3">
        {amendments.map((amendment) => (
          <div 
            key={amendment.id} 
            className="flex items-center justify-between gap-4 p-3 rounded-md bg-card border border-border"
          >
            <div className="min-w-0">
              <p className="font-medium text-sm text-foreground truncate">
                {amendment.title || "Amendment"}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(amendment.created_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewAmendment(amendment.id)}
            >
              View
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
