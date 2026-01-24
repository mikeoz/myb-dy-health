import { Eye, EyeOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface ReviewModeToggleProps {
  isReviewMode: boolean;
  onToggle: (value: boolean) => void;
}

/**
 * Toggle for switching between normal and review mode
 * 
 * Review mode enables event selection for visit summaries
 */
export function ReviewModeToggle({ isReviewMode, onToggle }: ReviewModeToggleProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border mb-4">
      <div className="flex items-center gap-2">
        {isReviewMode ? (
          <Eye className="h-4 w-4 text-primary" />
        ) : (
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        )}
        <Label htmlFor="review-mode" className="text-sm font-medium cursor-pointer">
          Review Mode
        </Label>
      </div>
      <Switch
        id="review-mode"
        checked={isReviewMode}
        onCheckedChange={onToggle}
      />
    </div>
  );
}
