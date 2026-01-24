import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { safeLog } from "@/lib/safe-logger";
import { format } from "date-fns";
import { FileText, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRef } from "react";

/**
 * Document List Component
 * 
 * GUARDRAIL: No PHI in logs
 * GUARDRAIL: User isolation via RLS
 * GUARDRAIL: Secure download via Edge Function proxy
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

/**
 * Build the Edge Function URL for document download.
 * Uses the proxy to avoid browser/extension blocking of signed URLs.
 */
const getDocumentDownloadUrl = (artifactId: string): string => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/documents-download?artifact_id=${encodeURIComponent(artifactId)}`;
};

export function DocumentList() {
  const { toast } = useToast();
  const downloadFormRef = useRef<HTMLFormElement>(null);
  const downloadIframeRef = useRef<HTMLIFrameElement>(null);

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

  const handleDownloadDocument = async (artifactId: string) => {
    try {
      // Get current session for auth header
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast({
          variant: "destructive",
          title: "Not authenticated",
          description: "Please sign in to download documents.",
        });
        return;
      }

      const downloadUrl = getDocumentDownloadUrl(artifactId);
      
      // Use fetch to download with auth header, then trigger browser download
      const response = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      // Get filename from Content-Disposition header if available
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "document";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) {
          filename = match[1];
        }
      }

      // Create blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      safeLog.info("Document downloaded", {
        action: "document_download_success",
        id: artifactId,
      });
    } catch (error) {
      safeLog.error("Failed to download document", {
        action: "document_download_error",
        errorType: error instanceof Error ? error.name : "unknown",
      });
      toast({
        variant: "destructive",
        title: "Unable to download document",
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
              onClick={() => handleDownloadDocument(doc.id)}
              className="flex-shrink-0"
            >
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
