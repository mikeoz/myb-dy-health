import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { safeLog } from "@/lib/safe-logger";
import { requireUserId, getOrCreateDataSource, getOrCreateDefaultConsentSnapshot } from "@/lib/write-helpers";
import { getString, getDocumentArtifactId, getDocType, getNotes, getText, getOptionalCategory } from "@/lib/event-details";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

/**
 * Amendment Modal
 * 
 * Allows users to create amendment events for journal entries or documents.
 * 
 * GUARDRAIL: Never UPDATE existing events - creates new amendment event
 * GUARDRAIL: No PHI in logs
 */

interface TimelineEvent {
  id: string;
  user_id: string;
  event_type: string;
  event_time: string;
  title: string | null;
  summary: string;
  details: Record<string, unknown> | null;
}

interface AmendmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  event: TimelineEvent;
  eventType: string;
}

const journalSchema = z.object({
  title: z.string().optional(),
  text: z.string().min(1, "Entry text is required"),
  category: z.string().optional(),
  eventTime: z.string(),
  note: z.string().optional(),
});

const documentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  docType: z.string().optional(),
  notes: z.string().optional(),
  documentDate: z.string(),
});

type JournalFormData = z.infer<typeof journalSchema>;
type DocumentFormData = z.infer<typeof documentSchema>;

const CATEGORY_OPTIONS = [
  { value: "symptom", label: "Symptom" },
  { value: "medication", label: "Medication" },
  { value: "mood", label: "Mood" },
  { value: "question", label: "Question" },
  { value: "other", label: "Other" },
];

const DOC_TYPE_OPTIONS = [
  { value: "lab", label: "Lab Results" },
  { value: "imaging", label: "Imaging" },
  { value: "visit_summary", label: "Visit Summary" },
  { value: "medication", label: "Medication" },
  { value: "insurance", label: "Insurance" },
  { value: "other", label: "Other" },
];

export function AmendmentModal({ isOpen, onClose, onSuccess, event, eventType }: AmendmentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isJournal = eventType === "journal_entry";
  const details = event.details;

  // Use safe helpers for extracting default values
  const journalForm = useForm<JournalFormData>({
    resolver: zodResolver(journalSchema),
    defaultValues: {
      title: event.title || "",
      text: getText(details) || "",
      category: getOptionalCategory(details) || "",
      eventTime: format(new Date(event.event_time), "yyyy-MM-dd'T'HH:mm"),
      note: "",
    },
  });

  const documentForm = useForm<DocumentFormData>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      title: event.title || "",
      docType: getDocType(details) || "",
      notes: getNotes(details) || "",
      documentDate: format(new Date(event.event_time), "yyyy-MM-dd"),
    },
  });

  const handleJournalSubmit = async (data: JournalFormData) => {
    setIsSubmitting(true);
    try {
      const userId = await requireUserId();
      const dataSourceId = await getOrCreateDataSource(userId, "manual", "User Journal Amendment");
      const consentSnapshotId = await getOrCreateDefaultConsentSnapshot(userId);

      // Create provenance record
      const { data: provenance, error: provError } = await supabase
        .from("provenance")
        .insert({
          data_source_id: dataSourceId,
          method: "manual_amendment",
          metadata: { client: "web", amendment_type: "journal" },
        })
        .select("id")
        .single();

      if (provError) throw provError;

      // Create amendment event
      const summary = data.text.slice(0, 140) + (data.text.length > 140 ? "..." : "");
      const amendmentTitle = `Amended: ${data.title || event.title || "Journal entry"}`;

      const { data: newEvent, error: eventError } = await supabase
        .from("timeline_events")
        .insert({
          user_id: userId,
          event_type: "event_amended",
          event_time: new Date().toISOString(),
          title: amendmentTitle,
          summary,
          details: {
            amends_event_id: event.id,
            amended_event_type: "journal_entry",
            text: data.text,
            category: data.category || null,
            original_event_time: event.event_time,
            note: data.note || null,
          },
          provenance_id: provenance.id,
          consent_snapshot_id: consentSnapshotId,
        })
        .select("id")
        .single();

      if (eventError) throw eventError;

      // Create audit event
      await supabase.from("audit_events").insert({
        user_id: userId,
        action: "event_amended",
        entity_type: "timeline_event",
        entity_id: newEvent.id,
      });

      safeLog.info("Journal amendment created", {
        action: "amendment_created",
        id: newEvent.id,
        resourceType: "timeline_event",
      });

      onSuccess();
    } catch (error) {
      safeLog.error("Failed to create amendment", {
        action: "amendment_error",
        errorType: error instanceof Error ? error.name : "unknown",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDocumentSubmit = async (data: DocumentFormData) => {
    setIsSubmitting(true);
    try {
      const userId = await requireUserId();
      const dataSourceId = await getOrCreateDataSource(userId, "manual", "Document Amendment");
      const consentSnapshotId = await getOrCreateDefaultConsentSnapshot(userId);

      // Create provenance record
      const { data: provenance, error: provError } = await supabase
        .from("provenance")
        .insert({
          data_source_id: dataSourceId,
          method: "manual_amendment",
          metadata: { client: "web", amendment_type: "document" },
        })
        .select("id")
        .single();

      if (provError) throw provError;

      // Create amendment event - use safe helper for document_artifact_id
      const amendmentTitle = `Amended: ${data.title}`;
      const docTypeLabel = DOC_TYPE_OPTIONS.find((o) => o.value === data.docType)?.label || data.docType;
      const documentArtifactId = getDocumentArtifactId(details);

      const { data: newEvent, error: eventError } = await supabase
        .from("timeline_events")
        .insert({
          user_id: userId,
          event_type: "event_amended",
          event_time: new Date().toISOString(),
          title: amendmentTitle,
          summary: `Updated ${docTypeLabel || "document"} details`,
          details: {
            amends_event_id: event.id,
            amended_event_type: "document_uploaded",
            document_artifact_id: documentArtifactId,
            title: data.title,
            doc_type: data.docType,
            notes: data.notes || null,
            document_date: data.documentDate,
          },
          provenance_id: provenance.id,
          consent_snapshot_id: consentSnapshotId,
        })
        .select("id")
        .single();

      if (eventError) throw eventError;

      // Create audit event
      await supabase.from("audit_events").insert({
        user_id: userId,
        action: "event_amended",
        entity_type: "timeline_event",
        entity_id: newEvent.id,
      });

      safeLog.info("Document amendment created", {
        action: "amendment_created",
        id: newEvent.id,
        resourceType: "timeline_event",
      });

      onSuccess();
    } catch (error) {
      safeLog.error("Failed to create document amendment", {
        action: "amendment_error",
        errorType: error instanceof Error ? error.name : "unknown",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isJournal ? "Amend Journal Entry" : "Amend Document Details"}
          </DialogTitle>
          <DialogDescription>
            Create an amendment to correct or update this {isJournal ? "entry" : "document's metadata"}.
            The original record remains unchanged.
          </DialogDescription>
        </DialogHeader>

        {isJournal ? (
          <Form {...journalForm}>
            <form onSubmit={journalForm.handleSubmit(handleJournalSubmit)} className="space-y-4">
              <FormField
                control={journalForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={journalForm.control}
                name="text"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entry Text</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Corrected entry text..." 
                        className="min-h-[120px]" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={journalForm.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category (optional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={journalForm.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amendment Note (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Reason for amendment" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Amendment
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <Form {...documentForm}>
            <form onSubmit={documentForm.handleSubmit(handleDocumentSubmit)} className="space-y-4">
              <FormField
                control={documentForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Document title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={documentForm.control}
                name="docType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DOC_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={documentForm.control}
                name="documentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={documentForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Additional notes..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Amendment
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
