import { Shield } from "lucide-react";

/**
 * Consent Page
 * 
 * Manage user consent preferences.
 * 
 * GUARDRAIL: Consent is explicit and snapshot-based
 * - Consent is captured explicitly (never inferred)
 * - Each data operation references an immutable consent snapshot
 * - Consent changes create new snapshots, don't modify old ones
 * 
 * GUARDRAIL: User isolation
 * - Users can only view and modify their own consent
 */
const Consent = () => {
  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Consent</h1>
        <p className="page-description">
          Manage how your health data is collected and used
        </p>
      </div>

      {/* Empty state - consent not yet captured */}
      <div className="empty-state">
        <Shield className="empty-state-icon" />
        <h3 className="empty-state-title">Consent not configured</h3>
        <p className="empty-state-description">
          Before using MyBödy, you'll need to review and provide consent for how your health data is handled.
        </p>
      </div>

      {/* TODO: Implement consent management
       * - Display current consent status
       * - Consent capture form with explicit checkboxes
       * - Terms version tracking
       * - Consent history (previous snapshots, read-only)
       * - Consent withdrawal flow
       * 
       * IMPORTANT: Never "smart" inference of consent
       * All consent must be explicitly captured
       */}
    </div>
  );
};

export default Consent;
