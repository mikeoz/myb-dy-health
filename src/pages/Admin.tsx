import { Bug, AlertTriangle, Briefcase, Activity, Loader2 } from "lucide-react";
import { isDevelopment } from "@/config/env";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { safeLog } from "@/lib/safe-logger";
import { format } from "date-fns";

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

  // Fetch jobs (metadata only - counts and status)
  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ["admin-jobs"],
    queryFn: async () => {
      safeLog.info("Admin: Fetching jobs", { action: "admin_jobs_fetch" });
      
      const { data, error } = await supabase
        .from("jobs")
        .select("id, job_type, status, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) {
        safeLog.error("Admin: Failed to fetch jobs", { 
          action: "admin_jobs_error",
          errorType: error.code 
        });
        throw error;
      }
      
      return data ?? [];
    },
  });

  // Fetch audit events (metadata only - NO PHI)
  const { data: auditEvents, isLoading: auditLoading } = useQuery({
    queryKey: ["admin-audit-events"],
    queryFn: async () => {
      safeLog.info("Admin: Fetching audit events", { action: "admin_audit_fetch" });
      
      const { data, error } = await supabase
        .from("audit_events")
        .select("id, action, entity_type, entity_id, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) {
        safeLog.error("Admin: Failed to fetch audit events", { 
          action: "admin_audit_error",
          errorType: error.code 
        });
        throw error;
      }
      
      return data ?? [];
    },
  });

  const isLoading = jobsLoading || auditLoading;

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

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Job Queue Panel */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Job Queue</h2>
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs">
                {jobs?.length ?? 0} jobs
              </span>
            </div>

            {jobs && jobs.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between rounded bg-muted/50 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">{job.job_type}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {job.id.slice(0, 8)}...
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          job.status === "complete"
                            ? "bg-green-500/20 text-green-600"
                            : job.status === "failed"
                            ? "bg-destructive/20 text-destructive"
                            : job.status === "running"
                            ? "bg-blue-500/20 text-blue-600"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No jobs in queue</p>
            )}
          </div>

          {/* Audit Events Panel */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Audit Events</h2>
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs">
                {auditEvents?.length ?? 0} events
              </span>
            </div>

            {auditEvents && auditEvents.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {auditEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between rounded bg-muted/50 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">{event.action}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        on {event.entity_type}
                      </span>
                    </div>
                    <time className="text-xs text-muted-foreground">
                      {format(new Date(event.created_at), "HH:mm:ss")}
                    </time>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No audit events recorded</p>
            )}

            {/* GUARDRAIL reminder */}
            <p className="mt-4 text-xs text-muted-foreground italic">
              Note: Audit events contain metadata only (IDs, actions, timestamps). No PHI.
            </p>
          </div>
        </div>
      )}

      {/* TODO: Future admin tools
       * - System health dashboard
       * - Database connection status
       * - Environment info panel
       * 
       * IMPORTANT: Restrict access in production via role-based access
       */}
    </div>
  );
};

export default Admin;
