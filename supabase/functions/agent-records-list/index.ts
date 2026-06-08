import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Agent Records List Edge Function
 *
 * Returns a list of timeline event summaries the calling agent is permitted to read.
 *
 * GUARDRAIL: No PHI in logs - audit records IDs and action types only.
 * GUARDRAIL: Session-token authenticated (not user JWT).
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
  if (!token || typeof token !== "string") {
    return { session: null, error: "missing" };
  }
  const { data, error } = await admin
    .from("agent_sessions")
    .select("id, user_id, allowed_ops, expires_at, revoked_at")
    .eq("session_token", token)
    .maybeSingle();

  if (error || !data) return { session: null, error: "invalid" };
  const s = data as AgentSession;
  if (s.revoked_at) return { session: null, error: "revoked" };
  if (new Date(s.expires_at).getTime() < Date.now()) {
    return { session: null, error: "expired" };
  }
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
    const filter = (body.filter ?? {}) as Record<string, unknown>;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { session, error: sessionErr } = await validateSession(admin, sessionToken);
    if (!session) {
      console.log(`[agent-records-list] auth_failed reason=${sessionErr}`);
      return json({ error: "Unauthorized" }, 401);
    }
    if (!session.allowed_ops.includes("read")) {
      console.log(`[agent-records-list] forbidden session=${session.id}`);
      return json({ error: "Forbidden: read not in allowed_ops" }, 403);
    }

    // Build query
    let query = admin
      .from("timeline_events")
      .select("id, event_type, event_time, title, summary, provenance_id")
      .eq("user_id", session.user_id)
      .order("event_time", { ascending: false });

    const eventTypes = Array.isArray(filter.event_types) ? filter.event_types : null;
    if (eventTypes && eventTypes.length > 0) {
      query = query.in("event_type", eventTypes as string[]);
    }
    if (typeof filter.after === "string") {
      query = query.gte("event_time", filter.after);
    }
    if (typeof filter.before === "string") {
      query = query.lte("event_time", filter.before);
    }
    const limit = typeof filter.limit === "number" && filter.limit > 0
      ? Math.min(filter.limit, 200)
      : 50;
    query = query.limit(limit);

    const { data: events, error: eventsErr } = await query;
    if (eventsErr) {
      console.log(`[agent-records-list] db_error code=${eventsErr.code}`);
      return json({ error: "Internal error" }, 500);
    }

    // Lookup provenance methods in batch
    const provenanceIds = [...new Set((events ?? []).map((e) => e.provenance_id).filter(Boolean))];
    const provMap = new Map<string, string>();
    if (provenanceIds.length > 0) {
      const { data: provs } = await admin
        .from("provenance")
        .select("id, method")
        .in("id", provenanceIds);
      for (const p of provs ?? []) provMap.set(p.id, p.method);
    }

    const records = (events ?? []).map((e) => ({
      id: e.id,
      event_type: e.event_type,
      event_time: e.event_time,
      title: e.title,
      summary: e.summary,
      has_document: e.event_type === "document_uploaded",
      provenance_method: provMap.get(e.provenance_id) ?? null,
    }));

    // Audit (no PHI)
    await admin.from("audit_events").insert({
      user_id: session.user_id,
      action: "agent_records_listed",
      entity_type: "agent_session",
      entity_id: session.id,
    });

    // Enforce Boundary CARD: one query per session
    await admin
      .from("agent_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", session.id);

    return json({
      records,
      total: records.length,
      session_expires_at: session.expires_at,
    });
  } catch (err) {
    console.error("[agent-records-list] unexpected_error");
    return json({ error: "Internal server error" }, 500);
  }
});
