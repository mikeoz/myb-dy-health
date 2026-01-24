import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { safeLog } from "@/lib/safe-logger";
import { format } from "date-fns";
import { FileText, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

/**
 * Document List Component
 * 
 * GUARDRAIL: No PHI in logs
 * GUARDRAIL: User isolation via RLS
 */

interface DocumentArtifact {
  id: string;
  title: string | null;
  doc_type: string | null;
  occurred_at: string | null;
  storage_path: string;
  content_type: string;
  file_size: number | null;
  original_filename: string | null;
  created_at: string;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  lab: "Lab Results",
  imaging: "Imaging",
  visit_summary: "Visit Summary",
  medication: "Medication",
  insurance: "Insurance",
  other: "Other",
};

export function DocumentList() {
  const { toast } = useToast();

  const { data: documents, isLoading, error } = useQuery({
    queryKey: ["document-artifacts"],
    queryFn: async () => {
      safeLog.info("Fetching documents", { action: "documents_fetch" });

      const { data, error } = await supabase
        .from("document_artifacts")
        .select("id, title, doc_type, occurred_at, storage_path, content_type, file_size, original_filename, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        safeLog.error("Failed to fetch documents", {
          action: "documents_fetch_error",
          errorType: error.code,
        });
        throw error;
      }

      safeLog.info("Documents fetched", {
        action: "documents_fetch_success",
        count: data?.length ?? 0,
      });

      return data as DocumentArtifact[];
    },
  });

  const handleViewDocument = async (storagePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(storagePath, 60 * 5); // 5 minute URL

      if (error) throw error;

      window.open(data.signedUrl, "_blank");
    } catch (error) {
      safeLog.error("Failed to get document URL", {
        action: "document_view_error",
        errorType: error instanceof Error ? error.name : "unknown",
      });
      toast({
        variant: "destructive",
        title: "Unable to view document",
        description: "Please try again.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <FileText className="empty-state-icon text-destructive" />
        <h3 className="empty-state-title">Unable to load documents</h3>
        <p className="empty-state-description">
          Please sign in to view your documents.
        </p>
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="empty-state">
        <FileText className="empty-state-icon" />
        <h3 className="empty-state-title">No documents yet</h3>
        <p className="empty-state-description">
          Upload lab results, medical records, and other health documents to build your health history.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="rounded-lg border border-border bg-card p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <FileText className="h-8 w-8 text-primary flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <h4 className="font-medium text-foreground truncate">
                  {doc.title || "Untitled Document"}
                </h4>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-sm text-muted-foreground">
                  <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs">
                    {DOC_TYPE_LABELS[doc.doc_type || "other"] || doc.doc_type}
                  </span>
                  {doc.occurred_at && (
                    <span>{format(new Date(doc.occurred_at), "MMM d, yyyy")}</span>
                  )}
                  {doc.file_size && (
                    <span>{(doc.file_size / 1024 / 1024).toFixed(2)} MB</span>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewDocument(doc.storage_path)}
              className="flex-shrink-0"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              View
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
