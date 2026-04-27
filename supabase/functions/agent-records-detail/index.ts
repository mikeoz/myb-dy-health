import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Agent Records Detail Edge Function
 *
 * Returns full record content for a single timeline event, including signed URL
 * for documents. Validated via session token.
 *
 * GUARDRAIL: Audit records THAT an access happened, not WHAT was accessed.
 *   No titles, summaries, filenames, or content in audit_events.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface AgentSession {
  id: string;
  user_id: string;
  allowed_ops: string[];
  expires_at: string;
  revoked_at: string | null;
}

async function validateSession(
  admin: ReturnType<typeof createClient>,
  token: string,
): Promise<{ session: AgentSession | null; error: "missing" | "invalid" | "expired" | "revoked" | null }> {
  if (!token || typeof token !== "string") return { session: null, error: "missing" };
  const { data, error } = await admin
    .from("agent_sessions")
    .select("id, user_id, allowed_ops, expires_at, revoked_at")
    .eq("session_token", token)
    .maybeSingle();
  if (error || !data) return { session: null, error: "invalid" };
  const s = data as AgentSession;
  if (s.revoked_at) return { session: null, error: "revoked" };
  if (new Date(s.expires_at).getTime() < Date.now()) return { session: null, error: "expired" };
  return { session: s, error: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const sessionToken = typeof body.session_token === "string" ? body.session_token : "";
    const recordId = typeof body.record_id === "string" ? body.record_id : "";
    if (!recordId) return json({ error: "record_id required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { session, error: sessionErr } = await validateSession(admin, sessionToken);
    if (!session) {
      console.log(`[agent-records-detail] auth_failed reason=${sessionErr}`);
      return json({ error: "Unauthorized" }, 401);
    }
    if (!session.allowed_ops.includes("read")) {
      console.log(`[agent-records-detail] forbidden session=${session.id}`);
      return json({ error: "Forbidden: read not in allowed_ops" }, 403);
    }

    // Fetch event scoped to this session's user
    const { data: event, error: eventErr } = await admin
      .from("timeline_events")
      .select("id, event_type, event_time, title, summary, details, provenance_id, consent_snapshot_id, user_id")
      .eq("id", recordId)
      .eq("user_id", session.user_id)
      .maybeSingle();

    if (eventErr) {
      console.log(`[agent-records-detail] db_error code=${eventErr.code}`);
      return json({ error: "Internal error" }, 500);
    }
    if (!event) {
      console.log(`[agent-records-detail] not_found_or_forbidden session=${session.id}`);
      return json({ error: "Record not found" }, 404);
    }

    // Provenance
    let provenance: { method: string; metadata: unknown; captured_at: string } | null = null;
    if (event.provenance_id) {
      const { data: p } = await admin
        .from("provenance")
        .select("method, metadata, captured_at")
        .eq("id", event.provenance_id)
        .maybeSingle();
      if (p) provenance = p as typeof provenance;
    }

    // Document (if applicable)
    let documentInfo: {
      url: string;
      content_type: string;
      file_size: number | null;
      original_filename: string | null;
    } | null = null;

    if (event.event_type === "document_uploaded" && event.provenance_id) {
      const { data: artifact } = await admin
        .from("document_artifacts")
        .select("storage_path, content_type, file_size, original_filename")
        .eq("user_id", session.user_id)
        .eq("provenance_id", event.provenance_id)
        .maybeSingle();

      if (artifact) {
        const { data: signed } = await admin.storage
          .from("documents")
          .createSignedUrl(artifact.storage_path, 60 * 15); // 15 min
        if (signed?.signedUrl) {
          documentInfo = {
            url: signed.signedUrl,
            content_type: artifact.content_type,
            file_size: artifact.file_size,
            original_filename: artifact.original_filename,
          };
        }
      }
    }

    // Audit - NO content, only IDs
    await admin.from("audit_events").insert({
      user_id: session.user_id,
      action: "agent_record_read",
      entity_type: "timeline_event",
      entity_id: event.id,
    });

    console.log(`[agent-records-detail] ok session=${session.id} record=${event.id}`);

    return json({
      record: {
        id: event.id,
        event_type: event.event_type,
        event_time: event.event_time,
        title: event.title,
        summary: event.summary,
        has_document: event.event_type === "document_uploaded",
        provenance_method: provenance?.method ?? null,
        details: event.details,
        provenance,
        consent_snapshot_id: event.consent_snapshot_id,
        document: documentInfo,
      },
    });
  } catch (err) {
    console.error("[agent-records-detail] unexpected_error");
    return json({ error: "Internal server error" }, 500);
  }
});
