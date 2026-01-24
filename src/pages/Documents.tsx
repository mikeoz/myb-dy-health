import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { DocumentList } from "@/components/documents/DocumentList";
import { DocumentUploadForm } from "@/components/documents/DocumentUploadForm";

/**
 * Documents Page
 * 
 * Manages uploaded health documents.
 * 
 * GUARDRAIL: Event-first data model
 * - Document uploads create immutable events
 * - Documents themselves are stored in secure storage
 * 
 * GUARDRAIL: Provenance is mandatory
 * - Every document must have provenance (who uploaded, when, how)
 * 
 * GUARDRAIL: User isolation
 * - Users can only access their own documents
 */
const Documents = () => {
  const [isUploadMode, setIsUploadMode] = useState(false);
  const queryClient = useQueryClient();

  const handleUploadSuccess = () => {
    setIsUploadMode(false);
    queryClient.invalidateQueries({ queryKey: ["document-artifacts"] });
    queryClient.invalidateQueries({ queryKey: ["timeline-events"] });
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="page-title">Documents</h1>
            <p className="page-description">
              Upload and manage your health documents
            </p>
          </div>
          {!isUploadMode && (
            <Button
              onClick={() => setIsUploadMode(true)}
              className="flex-shrink-0"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
          )}
        </div>
      </div>

      {isUploadMode ? (
        <div className="max-w-md mx-auto">
          <DocumentUploadForm
            onSuccess={handleUploadSuccess}
            onCancel={() => setIsUploadMode(false)}
          />
        </div>
      ) : (
        <DocumentList />
      )}
    </div>
  );
};

export default Documents;
