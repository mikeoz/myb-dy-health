import { Link2 } from "lucide-react";

/**
 * Sources Page
 * 
 * Manage connections to external health data sources.
 * 
 * GUARDRAIL: Server-only secrets
 * - API keys for external sources are stored server-side only
 * - Client only sees connection status, never credentials
 * 
 * GUARDRAIL: Provenance is mandatory
 * - Data from external sources includes provenance (source, sync time)
 * 
 * GUARDRAIL: Asynchronous by default
 * - Data sync operations are modeled as async jobs
 * 
 * EXPLICIT NON-GOAL: No external healthcare APIs in v1
 * - This page is a placeholder for future integrations
 */
const Sources = () => {
  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Sources</h1>
        <p className="page-description">
          Connect to external health data providers
        </p>
      </div>

      {/* Empty state - no sources connected */}
      <div className="empty-state">
        <Link2 className="empty-state-icon" />
        <h3 className="empty-state-title">No sources connected</h3>
        <p className="empty-state-description">
          Connect to healthcare providers to automatically import your health records.
        </p>
      </div>

      {/* TODO: Implement source connections
       * - List available integrations (Fasten, etc.)
       * - OAuth flow for connecting sources
       * - Display sync status and last sync time
       * - Manual sync trigger (creates async job)
       * - Disconnect source option
       * 
       * NOTE: External API integrations are a non-goal for v1
       */}
    </div>
  );
};

export default Sources;
