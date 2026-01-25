import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type FilterValue = "all" | "journal" | "documents" | "external";

interface TimelineFiltersProps {
  value: FilterValue;
  onChange: (value: FilterValue) => void;
}

/**
 * Timeline filter controls - mobile-first segmented buttons
 */
export function TimelineFilters({ value, onChange }: TimelineFiltersProps) {
  return (
    <div className="mb-6">
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v as FilterValue)}
        className="w-full grid grid-cols-4 gap-1 bg-muted p-1 rounded-lg"
      >
        <ToggleGroupItem
          value="all"
          className="h-10 text-sm font-medium data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm rounded-md"
        >
          All
        </ToggleGroupItem>
        <ToggleGroupItem
          value="journal"
          className="h-10 text-sm font-medium data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm rounded-md"
        >
          Journal
        </ToggleGroupItem>
        <ToggleGroupItem
          value="documents"
          className="h-10 text-sm font-medium data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm rounded-md"
        >
          Documents
        </ToggleGroupItem>
        <ToggleGroupItem
          value="external"
          className="h-10 text-sm font-medium data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm rounded-md"
        >
          External
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
