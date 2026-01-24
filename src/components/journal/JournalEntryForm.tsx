import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { safeLog } from "@/lib/safe-logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

/**
 * Journal Entry Form Component
 * 
 * GUARDRAIL: No PHI in logs
 * - Only log IDs, timestamps, and category (metadata)
 * - Never log entry text, titles, or user content
 * 
 * GUARDRAIL: Event-first data model
 * - Creates immutable timeline event with provenance
 */

const CATEGORIES = [
  { value: "symptom", label: "Symptom" },
  { value: "medication", label: "Medication" },
  { value: "mood", label: "Mood" },
  { value: "question", label: "Question" },
  { value: "other", label: "Other" },
] as const;

const journalSchema = z.object({
  title: z.string().max(100, "Title must be under 100 characters").optional(),
  entryText: z.string()
    .min(1, "Entry text is required")
    .max(5000, "Entry must be under 5000 characters"),
  category: z.string().optional(),
  eventDateTime: z.string().min(1, "Event date is required"),
});

type JournalFormData = z.infer<typeof journalSchema>;

export function JournalEntryForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<JournalFormData>({
    resolver: zodResolver(journalSchema),
    defaultValues: {
      title: "",
      entryText: "",
      category: "",
      eventDateTime: new Date().toISOString().slice(0, 16), // Format for datetime-local
    },
  });

  const onSubmit = async (data: JournalFormData) => {
    setIsSubmitting(true);
    safeLog.info("Journal entry submission started", { action: "journal_create_start" });

    try {
      // Get current user
      const { data: session, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session.session) {
        throw new Error("Not authenticated");
      }
      const userId = session.session.user.id;

      // 1. Create or get a data source for user journal
      const { data: existingSource } = await supabase
        .from("data_sources")
        .select("id")
        .eq("user_id", userId)
        .eq("type", "manual")
        .eq("name", "User Journal")
        .maybeSingle();

      let dataSourceId: string;
      if (existingSource) {
        dataSourceId = existingSource.id;
      } else {
        const { data: newSource, error: sourceError } = await supabase
          .from("data_sources")
          .insert({
            user_id: userId,
            type: "manual",
            name: "User Journal",
            status: "active",
          })
          .select("id")
          .single();

        if (sourceError) throw sourceError;
        dataSourceId = newSource.id;
      }

      // 2. Create provenance record
      const { data: provenance, error: provError } = await supabase
        .from("provenance")
        .insert({
          data_source_id: dataSourceId,
          method: "manual_entry",
          captured_at: new Date().toISOString(),
          metadata: {
            client: "web",
            category: data.category || "other",
          },
        })
        .select("id")
        .single();

      if (provError) throw provError;

      // 3. Get or create a default consent snapshot
      // First check for existing consent agreement
      let consentSnapshotId: string;
      const { data: existingAgreement } = await supabase
        .from("consent_agreements")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingAgreement) {
        // Check for existing snapshot
        const { data: existingSnapshot } = await supabase
          .from("consent_snapshots")
          .select("id")
          .eq("consent_agreement_id", existingAgreement.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingSnapshot) {
          consentSnapshotId = existingSnapshot.id;
        } else {
          // Create snapshot for existing agreement
          const { data: newSnapshot, error: snapError } = await supabase
            .from("consent_snapshots")
            .insert({
              consent_agreement_id: existingAgreement.id,
              permissions: { store_health_data: true, create_timeline_events: true },
            })
            .select("id")
            .single();

          if (snapError) throw snapError;
          consentSnapshotId = newSnapshot.id;
        }
      } else {
        // Create new consent agreement and snapshot
        const { data: newAgreement, error: agreementError } = await supabase
          .from("consent_agreements")
          .insert({
            user_id: userId,
            scope: "health_data_storage",
          })
          .select("id")
          .single();

        if (agreementError) throw agreementError;

        const { data: newSnapshot, error: snapError } = await supabase
          .from("consent_snapshots")
          .insert({
            consent_agreement_id: newAgreement.id,
            permissions: { store_health_data: true, create_timeline_events: true },
          })
          .select("id")
          .single();

        if (snapError) throw snapError;
        consentSnapshotId = newSnapshot.id;
      }

      // 4. Create timeline event
      const eventTime = new Date(data.eventDateTime).toISOString();
      const summary = data.entryText.slice(0, 140) + (data.entryText.length > 140 ? "..." : "");

      const { data: timelineEvent, error: eventError } = await supabase
        .from("timeline_events")
        .insert({
          user_id: userId,
          event_type: "journal_entry",
          event_time: eventTime,
          title: data.title || "Journal entry",
          summary,
          details: {
            text: data.entryText,
            category: data.category || "other",
          },
          provenance_id: provenance.id,
          consent_snapshot_id: consentSnapshotId,
        })
        .select("id")
        .single();

      if (eventError) throw eventError;

      // 5. Create audit event (IDs only, no PHI)
      await supabase.from("audit_events").insert({
        user_id: userId,
        action: "journal_created",
        entity_type: "timeline_event",
        entity_id: timelineEvent.id,
      });

      safeLog.info("Journal entry created", {
        action: "journal_create_success",
        id: timelineEvent.id,
        resourceType: "timeline_event",
      });

      toast({
        title: "Saved to Timeline",
        description: "Your journal entry has been recorded.",
      });

      navigate("/timeline");
    } catch (error) {
      safeLog.error("Journal entry creation failed", {
        action: "journal_create_error",
        errorType: error instanceof Error ? error.name : "unknown",
      });

      toast({
        variant: "destructive",
        title: "Error saving entry",
        description: "Please try again or check your connection.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Title (optional) */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title (optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Give your entry a title..."
                  {...field}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Entry text (required) */}
        <FormField
          control={form.control}
          name="entryText"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Entry</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="What would you like to record? Symptoms, medications, mood, questions for your doctor..."
                  className="min-h-[150px] resize-y"
                  {...field}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Category (optional) */}
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category (optional)</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                disabled={isSubmitting}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Event date/time */}
        <FormField
          control={form.control}
          name="eventDateTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>When did this happen?</FormLabel>
              <FormControl>
                <Input
                  type="datetime-local"
                  {...field}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Action buttons */}
        <div className="flex flex-col gap-3 pt-4">
          <Button
            type="submit"
            className="w-full h-12 text-base"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save to Timeline"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 text-base"
            onClick={() => navigate("/home")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
