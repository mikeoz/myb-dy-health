/**
 * Fasten Demo Sync Edge Function
 * 
 * Simulates a Fasten Health sync by generating demo timeline events.
 * This is a patient-authorized external ingestion demo that creates
 * event-level summaries, not full medical records.
 * 
 * GUARDRAIL: No PHI in logs
 * GUARDRAIL: User isolation via JWT authentication
 * GUARDRAIL: All imported data becomes immutable timeline_events
 * GUARDRAIL: Provenance and consent snapshots are mandatory
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DemoExternalEvent {
  category: string;
  title: string;
  summary: string;
  providerName: string;
  occurredAt: string;
}

// Curated demo data representing external health records
const DEMO_EVENTS: DemoExternalEvent[] = [
  {
    category: "encounter",
    title: "Annual Physical Examination",
    summary: "Routine annual physical with Dr. Smith at City Medical Center. General health assessment completed.",
    providerName: "City Medical Center",
    occurredAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
  },
  {
    category: "lab_results",
    title: "Complete Blood Count (CBC)",
    summary: "Standard blood panel completed. Results within normal ranges.",
    providerName: "LabCorp",
    occurredAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(), // 28 days ago
  },
  {
    category: "lab_results",
    title: "Lipid Panel",
    summary: "Cholesterol and triglyceride levels measured. Reviewed by primary care physician.",
    providerName: "LabCorp",
    occurredAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(), // 28 days ago
  },
  {
    category: "medication",
    title: "Medication Prescription - Lisinopril",
    summary: "Prescription for blood pressure management. 10mg daily dosage.",
    providerName: "City Medical Center",
    occurredAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(), // 25 days ago
  },
  {
    category: "encounter",
    title: "Follow-up Visit",
    summary: "Follow-up consultation to review lab results and adjust treatment plan.",
    providerName: "City Medical Center",
    occurredAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
  },
  {
    category: "document_reference",
    title: "Imaging Report - Chest X-Ray",
    summary: "Chest X-ray performed for routine screening. No abnormalities detected.",
    providerName: "City Medical Imaging",
    occurredAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
  },
];

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("[fasten-demo-sync] No authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { source_id } = await req.json();
    if (!source_id) {
      return new Response(
        JSON.stringify({ error: "source_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with user's auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log("[fasten-demo-sync] Auth error");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    console.log(`[fasten-demo-sync] Starting sync for source: ${source_id}`);

    // Verify source belongs to user
    const { data: source, error: sourceError } = await supabase
      .from("data_sources")
      .select("id, name, provider")
      .eq("id", source_id)
      .eq("user_id", userId)
      .single();

    if (sourceError || !source) {
      console.log("[fasten-demo-sync] Source not found or access denied");
      return new Response(
        JSON.stringify({ error: "Source not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get or create consent agreement
    const { data: consentAgreement, error: consentAgreementError } = await supabase
      .from("consent_agreements")
      .select("id")
      .eq("user_id", userId)
      .eq("scope", "health_data")
      .maybeSingle();

    let consentAgreementId: string;

    if (!consentAgreement) {
      const { data: newConsent, error: newConsentError } = await supabase
        .from("consent_agreements")
        .insert({
          user_id: userId,
          scope: "health_data",
        })
        .select("id")
        .single();

      if (newConsentError) {
        console.log("[fasten-demo-sync] Failed to create consent agreement");
        throw new Error("Failed to create consent agreement");
      }
      consentAgreementId = newConsent.id;
    } else {
      consentAgreementId = consentAgreement.id;
    }

    // Create consent snapshot for this import
    const { data: consentSnapshot, error: snapshotError } = await supabase
      .from("consent_snapshots")
      .insert({
        consent_agreement_id: consentAgreementId,
        permissions: {
          external_import: true,
          source: "fasten",
          authorized_at: new Date().toISOString(),
        },
      })
      .select("id")
      .single();

    if (snapshotError) {
      console.log("[fasten-demo-sync] Failed to create consent snapshot");
      throw new Error("Failed to create consent snapshot");
    }

    // Create provenance record for this sync
    const { data: provenance, error: provenanceError } = await supabase
      .from("provenance")
      .insert({
        data_source_id: source_id,
        method: "portal_import",
        metadata: {
          source: "fasten",
          sync_type: "demo",
          synced_at: new Date().toISOString(),
        },
      })
      .select("id")
      .single();

    if (provenanceError) {
      console.log("[fasten-demo-sync] Failed to create provenance");
      throw new Error("Failed to create provenance");
    }

    // Create timeline events from demo data
    const timelineEvents = DEMO_EVENTS.map((event) => ({
      user_id: userId,
      event_type: "external_event",
      event_time: event.occurredAt,
      title: event.title,
      summary: event.summary,
      provenance_id: provenance.id,
      consent_snapshot_id: consentSnapshot.id,
      details: {
        source: "fasten",
        resource_category: event.category,
        provider_name: event.providerName,
        is_demo: true,
      },
    }));

    const { data: insertedEvents, error: eventsError } = await supabase
      .from("timeline_events")
      .insert(timelineEvents)
      .select("id");

    if (eventsError) {
      console.log("[fasten-demo-sync] Failed to insert events");
      throw new Error("Failed to insert timeline events");
    }

    // Update source sync status
    const { error: updateError } = await supabase
      .from("data_sources")
      .update({
        connection_state: "connected",
        last_sync_at: new Date().toISOString(),
        last_sync_status: "ok",
        last_error_code: null,
        last_error_at: null,
      })
      .eq("id", source_id);

    if (updateError) {
      console.log("[fasten-demo-sync] Failed to update source status");
    }

    // Create audit event
    await supabase.from("audit_events").insert({
      user_id: userId,
      action: "external_events_imported",
      entity_type: "data_source",
      entity_id: source_id,
    });

    console.log(`[fasten-demo-sync] Sync complete, imported ${insertedEvents?.length ?? 0} events`);

    return new Response(
      JSON.stringify({
        success: true,
        imported_count: insertedEvents?.length ?? 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[fasten-demo-sync] Error:", error instanceof Error ? error.message : "Unknown error");
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
