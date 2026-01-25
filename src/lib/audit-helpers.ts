import { supabase } from "@/integrations/supabase/client";
import { safeLog } from "@/lib/safe-logger";

/**
 * Audit Helpers
 * 
 * Utilities for creating audit events that track user actions.
 * 
 * GUARDRAIL: No PHI in logs
 * - Only log IDs, timestamps, and action types
 * - Never log user content or health data
 */

export type AuditAction =
  | "review_started"
  | "visit_summary_created"
  | "share_preview_viewed"
  | "source_sync_requested"
  | "external_source_connected"
  | "external_sync_requested"
  | "external_events_imported";

/**
 * Create an audit event for a user action.
 * Fails silently to avoid blocking user workflows.
 */
export async function createAuditEvent(
  action: AuditAction,
  entityType: string,
  entityId: string
): Promise<void> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      safeLog.warn("Cannot create audit event without session", {
        action: "audit_event_skipped",
      });
      return;
    }

    const { error } = await supabase.from("audit_events").insert({
      user_id: session.session.user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
    });

    if (error) {
      safeLog.error("Failed to create audit event", {
        action: "audit_event_error",
        errorType: error.code,
      });
    } else {
      safeLog.info("Audit event created", {
        action: "audit_event_success",
        auditAction: action,
        entityType,
      });
    }
  } catch (err) {
    safeLog.error("Audit event exception", {
      action: "audit_event_exception",
      errorType: err instanceof Error ? err.name : "unknown",
    });
  }
}
