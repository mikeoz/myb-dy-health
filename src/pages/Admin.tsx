import { Bug, AlertTriangle } from "lucide-react";
import { isDevelopment } from "@/config/env";

/**
 * Admin / Debug Page
 * 
 * Development and debugging tools.
 * 
 * GUARDRAIL: User isolation
 * - Even in admin view, no cross-user data access
 * - This page shows system status, not user data
 * 
 * GUARDRAIL: No PHI in logs
 * - Debug output must never contain PHI
 * - Only metadata (IDs, counts, timestamps) can be displayed
 * 
 * NOTE: This page should be restricted or hidden in production
 */
const Admin = () => {
  const isDevMode = isDevelopment();

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Admin / Debug</h1>
        <p className="page-description">
          Development and debugging tools
        </p>
      </div>

      {/* Production warning */}
      {!isDevMode && (
        <div className="mb-6 p-4 rounded-lg border border-warning bg-warning/10">
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">Production Environment</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            This page should not be accessible in production.
          </p>
        </div>
      )}

      {/* Debug panel */}
      <div className="empty-state">
        <Bug className="empty-state-icon" />
        <h3 className="empty-state-title">Debug tools not implemented</h3>
        <p className="empty-state-description">
          System health, job queue status, and other debug information will appear here.
        </p>
      </div>

      {/* TODO: Implement admin/debug tools
       * - System health status
       * - Job queue status (counts only, no PHI)
       * - Database connection status
       * - Environment information
       * - Log viewer (metadata only, no PHI)
       * 
       * IMPORTANT: Restrict access in production
       * - Check user role/permissions
       * - Audit log all admin page access
       */}
    </div>
  );
};

export default Admin;
