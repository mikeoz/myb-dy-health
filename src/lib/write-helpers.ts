import { supabase } from "@/integrations/supabase/client";
import { safeLog } from "@/lib/safe-logger";

/**
 * Write Helpers
 * 
 * Shared utilities for creating timeline events with proper provenance and consent.
 * 
 * GUARDRAIL: No PHI in logs
 * - Only log IDs, timestamps, and action types
 * - Never log user content, filenames, or health data
 */

/**
 * Get the authenticated user's ID.
 * Throws if no active session.
 */
export async function requireUserId(): Promise<string> {
  const { data: session, error } = await supabase.auth.getSession();
  
  if (error || !session.session) {
    safeLog.warn("Authentication required", { action: "require_user_id_failed" });
    throw new Error("Not authenticated");
  }
  
  return session.session.user.id;
}

/**
 * Get or create a data source for the user.
 * 
 * @param userId - The authenticated user's ID
 * @param type - "manual" for journal entries, "upload" for document uploads
 * @param name - Human-readable source name (e.g., "User Journal", "User Upload")
 * @returns The data source ID
 */
export async function getOrCreateDataSource(
  userId: string,
  type: "manual" | "upload",
  name: string
): Promise<string> {
  // Check for existing data source
  const { data: existing } = await supabase
    .from("data_sources")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .eq("name", name)
    .maybeSingle();

  if (existing) {
    return existing.id;
  }

  // Create new data source
  const { data: newSource, error } = await supabase
    .from("data_sources")
    .insert({
      user_id: userId,
      type,
      name,
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    safeLog.error("Failed to create data source", {
      action: "create_data_source_error",
      errorType: error.code,
    });
    throw error;
  }

  safeLog.info("Created data source", {
    action: "create_data_source_success",
    id: newSource.id,
    resourceType: "data_source",
  });

  return newSource.id;
}

/**
 * Get or create a default consent snapshot for the user.
 * 
 * Creates a consent agreement if none exists, then creates or retrieves
 * the latest consent snapshot.
 * 
 * @param userId - The authenticated user's ID
 * @returns The consent snapshot ID
 */
export async function getOrCreateDefaultConsentSnapshot(userId: string): Promise<string> {
  // Check for existing consent agreement
  const { data: existingAgreement } = await supabase
    .from("consent_agreements")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  let agreementId: string;

  if (existingAgreement) {
    agreementId = existingAgreement.id;
  } else {
    // Create new consent agreement
    const { data: newAgreement, error: agreementError } = await supabase
      .from("consent_agreements")
      .insert({
        user_id: userId,
        scope: "health_data_storage",
      })
      .select("id")
      .single();

    if (agreementError) {
      safeLog.error("Failed to create consent agreement", {
        action: "create_consent_agreement_error",
        errorType: agreementError.code,
      });
      throw agreementError;
    }

    safeLog.info("Created consent agreement", {
      action: "create_consent_agreement_success",
      id: newAgreement.id,
      resourceType: "consent_agreement",
    });

    agreementId = newAgreement.id;
  }

  // Check for existing snapshot
  const { data: existingSnapshot } = await supabase
    .from("consent_snapshots")
    .select("id")
    .eq("consent_agreement_id", agreementId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingSnapshot) {
    return existingSnapshot.id;
  }

  // Create new snapshot
  const { data: newSnapshot, error: snapError } = await supabase
    .from("consent_snapshots")
    .insert({
      consent_agreement_id: agreementId,
      permissions: {
        store_health_data: true,
        create_timeline_events: true,
      },
    })
    .select("id")
    .single();

  if (snapError) {
    safeLog.error("Failed to create consent snapshot", {
      action: "create_consent_snapshot_error",
      errorType: snapError.code,
    });
    throw snapError;
  }

  safeLog.info("Created consent snapshot", {
    action: "create_consent_snapshot_success",
    id: newSnapshot.id,
    resourceType: "consent_snapshot",
  });

  return newSnapshot.id;
}
