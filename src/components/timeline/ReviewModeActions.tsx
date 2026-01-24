import { ClipboardList, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReviewModeActionsProps {
  selectedCount: number;
  onCreateSummary: () => void;
  onPreviewShare: () => void;
}

/**
 * Action bar shown in review mode when events are selected
 */
export function ReviewModeActions({ 
  selectedCount, 
  onCreateSummary,
  onPreviewShare 
}: ReviewModeActionsProps) {
  if (selectedCount === 0) {
    return (
      <div className="p-4 bg-muted/30 rounded-lg border border-dashed border-border text-center mb-4">
        <p className="text-sm text-muted-foreground">
          Select events to create a visit summary or preview for sharing
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-primary/5 rounded-lg border border-primary/20 mb-4">
      <p className="text-sm font-medium text-foreground">
        {selectedCount} event{selectedCount !== 1 ? "s" : ""} selected
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onPreviewShare}
          className="w-full sm:w-auto"
        >
          <Eye className="h-4 w-4 mr-2" />
          Share Preview
        </Button>
        <Button 
          size="sm" 
          onClick={onCreateSummary}
          className="w-full sm:w-auto"
        >
          <ClipboardList className="h-4 w-4 mr-2" />
          Create Visit Summary
        </Button>
      </div>
    </div>
  );
}
