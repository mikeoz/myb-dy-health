import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { safeLog } from "@/lib/safe-logger";
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
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, FileText, X } from "lucide-react";

/**
 * Document Upload Form Component
 * 
 * GUARDRAIL: No PHI in logs
 * - Only log IDs, file types, and sizes
 * - Never log filenames or document content
 * 
 * GUARDRAIL: Event-first data model
 * - Creates immutable document artifact with provenance
 */

const DOC_TYPES = [
  { value: "lab", label: "Lab Results" },
  { value: "imaging", label: "Imaging" },
  { value: "visit_summary", label: "Visit Summary" },
  { value: "medication", label: "Medication" },
  { value: "insurance", label: "Insurance" },
  { value: "other", label: "Other" },
] as const;

const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/heic",
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const uploadSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be under 200 characters"),
  docType: z.string().min(1, "Document type is required"),
  documentDate: z.string().min(1, "Document date is required"),
  notes: z.string().max(500, "Notes must be under 500 characters").optional(),
});

type UploadFormData = z.infer<typeof uploadSchema>;

interface DocumentUploadFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function DocumentUploadForm({ onSuccess, onCancel }: DocumentUploadFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      title: "",
      docType: "",
      documentDate: new Date().toISOString().slice(0, 10), // Format for date input
      notes: "",
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setFileError(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    // Validate file type
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      setFileError("Please select a PDF or image file (PNG, JPG, HEIC)");
      setSelectedFile(null);
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setFileError("File must be under 20MB");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    // Auto-fill title from filename if empty
    if (!form.getValues("title")) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      form.setValue("title", nameWithoutExt);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const onSubmit = async (data: UploadFormData) => {
    if (!selectedFile) {
      setFileError("Please select a file to upload");
      return;
    }

    setIsSubmitting(true);
    safeLog.info("Document upload started", { action: "document_upload_start" });

    let storagePath: string | null = null;

    try {
      // Get current user
      const { data: session, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session.session) {
        throw new Error("Not authenticated");
      }
      const userId = session.session.user.id;

      // 1. Upload file to storage
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const uniqueId = crypto.randomUUID();
      const safeFilename = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      storagePath = `${userId}/${year}/${month}/${uniqueId}-${safeFilename}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, selectedFile, {
          contentType: selectedFile.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      safeLog.info("File uploaded to storage", {
        action: "storage_upload_success",
        resourceType: "document",
      });

      // 2. Create or get data source for user uploads
      const { data: existingSource } = await supabase
        .from("data_sources")
        .select("id")
        .eq("user_id", userId)
        .eq("type", "upload")
        .eq("name", "User Upload")
        .maybeSingle();

      let dataSourceId: string;
      if (existingSource) {
        dataSourceId = existingSource.id;
      } else {
        const { data: newSource, error: sourceError } = await supabase
          .from("data_sources")
          .insert({
            user_id: userId,
            type: "upload",
            name: "User Upload",
            status: "active",
          })
          .select("id")
          .single();

        if (sourceError) throw sourceError;
        dataSourceId = newSource.id;
      }

      // 3. Create provenance record (no PHI in metadata)
      const { data: provenance, error: provError } = await supabase
        .from("provenance")
        .insert({
          data_source_id: dataSourceId,
          method: "upload",
          captured_at: new Date().toISOString(),
          metadata: {
            doc_type: data.docType,
            mime: selectedFile.type,
            size_bytes: selectedFile.size,
          },
        })
        .select("id")
        .single();

      if (provError) throw provError;

      // 4. Create document artifact
      const { data: artifact, error: artifactError } = await supabase
        .from("document_artifacts")
        .insert({
          user_id: userId,
          title: data.title,
          doc_type: data.docType,
          occurred_at: new Date(data.documentDate).toISOString(),
          storage_path: storagePath,
          content_type: selectedFile.type,
          file_size: selectedFile.size,
          original_filename: selectedFile.name,
          provenance_id: provenance.id,
        })
        .select("id")
        .single();

      if (artifactError) throw artifactError;

      // 5. Get or create consent snapshot
      let consentSnapshotId: string;
      const { data: existingAgreement } = await supabase
        .from("consent_agreements")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingAgreement) {
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

      // 6. Create timeline event
      const docTypeLabel = DOC_TYPES.find((t) => t.value === data.docType)?.label || data.docType;
      
      const { data: timelineEvent, error: eventError } = await supabase
        .from("timeline_events")
        .insert({
          user_id: userId,
          event_type: "document_uploaded",
          event_time: new Date(data.documentDate).toISOString(),
          title: data.title,
          summary: `Uploaded ${docTypeLabel} document`,
          details: {
            document_artifact_id: artifact.id,
            doc_type: data.docType,
            notes: data.notes || null,
          },
          provenance_id: provenance.id,
          consent_snapshot_id: consentSnapshotId,
        })
        .select("id")
        .single();

      if (eventError) throw eventError;

      // 7. Create audit event (IDs only)
      await supabase.from("audit_events").insert({
        user_id: userId,
        action: "document_uploaded",
        entity_type: "document_artifact",
        entity_id: artifact.id,
      });

      safeLog.info("Document upload completed", {
        action: "document_upload_success",
        id: artifact.id,
        resourceType: "document_artifact",
      });

      toast({
        title: "Document uploaded",
        description: "Your document has been saved.",
      });

      onSuccess();
    } catch (error) {
      safeLog.error("Document upload failed", {
        action: "document_upload_error",
        errorType: error instanceof Error ? error.name : "unknown",
      });

      // Attempt cleanup if file was uploaded but DB insert failed
      if (storagePath) {
        try {
          await supabase.storage.from("documents").remove([storagePath]);
          safeLog.info("Cleaned up orphaned file", { action: "storage_cleanup" });
        } catch {
          safeLog.warn("Failed to cleanup orphaned file", { action: "storage_cleanup_failed" });
        }
      }

      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "Please try again or check your connection.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* File picker */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Document File</label>
          <div className="space-y-3">
            {!selectedFile ? (
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium text-foreground">
                  Click to select a file
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, PNG, JPG up to 20MB
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-secondary/50 rounded-lg">
                <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={clearFile}
                  disabled={isSubmitting}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.heic"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isSubmitting}
            />
          </div>
          {fileError && (
            <p className="text-sm text-destructive">{fileError}</p>
          )}
        </div>

        {/* Title */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Document Title</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Blood Work Results - January 2024"
                  {...field}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Document type */}
        <FormField
          control={form.control}
          name="docType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Document Type</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                disabled={isSubmitting}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {DOC_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Document date */}
        <FormField
          control={form.control}
          name="documentDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Document Date</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  {...field}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Notes (optional) */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Any additional context about this document..."
                  className="resize-y min-h-[80px]"
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
            disabled={isSubmitting || !selectedFile}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              "Upload Document"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 text-base"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
