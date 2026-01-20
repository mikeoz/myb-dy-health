import { Settings as SettingsIcon } from "lucide-react";

/**
 * Settings Page
 * 
 * User account settings and preferences.
 * 
 * GUARDRAIL: User isolation
 * - Users can only modify their own settings
 * - No admin bypass, no cross-user access
 * 
 * GUARDRAIL: No PHI in logs
 * - Settings changes are logged with metadata only
 */
const Settings = () => {
  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-description">
          Manage your account and preferences
        </p>
      </div>

      {/* Empty state - no user logged in */}
      <div className="empty-state">
        <SettingsIcon className="empty-state-icon" />
        <h3 className="empty-state-title">Settings unavailable</h3>
        <p className="empty-state-description">
          Sign in to access your account settings and preferences.
        </p>
      </div>

      {/* TODO: Implement settings
       * - Profile information (name, email - display only, edit via secure flow)
       * - Notification preferences
       * - Display preferences
       * - Data export request (creates async job)
       * - Account deletion request (creates async job)
       */}
    </div>
  );
};

export default Settings;
