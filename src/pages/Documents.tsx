import { FileText } from "lucide-react";

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
  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Documents</h1>
        <p className="page-description">
          Upload and manage your health documents
        </p>
      </div>

      {/* Empty state - no documents yet */}
      <div className="empty-state">
        <FileText className="empty-state-icon" />
        <h3 className="empty-state-title">No documents yet</h3>
        <p className="empty-state-description">
          Upload lab results, medical records, and other health documents to build your health history.
        </p>
      </div>

      {/* TODO: Implement document management
       * - File upload with drag-and-drop
       * - Document type classification
       * - Provenance capture on upload
       * - Consent verification before upload
       * - Async job for document processing
       */}
    </div>
  );
};

export default Documents;
