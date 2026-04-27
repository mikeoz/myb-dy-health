import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Agent Authorize Edge Function (CARD Receiver Stub)
 *
 * Accepts an agent's authorization request and issues a session token.
 * This is a STUB: the `card_set` field is accepted but ignored. Session C
 * will replace this with real CARD Set validation via the CARD Receiver SDK.
 *
 * Read-only enforcement: any request with "write" or "delete" in
 * requested_ops is rejected (MedGraph is read-only).
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

    const agentId = typeof body.agent_id === "string" ? body.agent_id : "";
    const agentName = typeof body.agent_name === "string" && body.agent_name
      ? body.agent_name
      : "Unknown Agent";
    const userId = typeof body.user_id === "string" ? body.user_id : "";
    const requestedOps = Array.isArray(body.requested_ops) ? body.requested_ops : [];

    if (!agentId || !userId) {
      return json({ error: "agent_id and user_id required" }, 400);
    }

    // Read-only enforcement
    const ops = requestedOps.filter((o) => typeof o === "string") as string[];
    const disallowed = ops.filter((o) => o !== "read");
    if (disallowed.length > 0) {
      console.log(`[agent-authorize] rejected_write_request agent=${agentId}`);
      return json({ error: "MedGraph is read-only" }, 403);
    }
    if (ops.length === 0) ops.push("read");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Verify the user exists (don't return PHI in errors)
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) {
      console.log(`[agent-authorize] unknown_user agent=${agentId}`);
      return json({ error: "Unknown user" }, 404);
    }

    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h

    const { data: inserted, error: insertErr } = await admin
      .from("agent_sessions")
      .insert({
        user_id: userId,
        agent_id: agentId,
        agent_name: agentName,
        session_token: sessionToken,
        allowed_ops: ops,
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      console.log(`[agent-authorize] insert_failed code=${insertErr?.code}`);
      return json({ error: "Failed to create session" }, 500);
    }

    // Audit
    await admin.from("audit_events").insert({
      user_id: userId,
      action: "agent_session_created",
      entity_type: "agent_session",
      entity_id: inserted.id,
    });

    console.log(`[agent-authorize] ok session=${inserted.id} agent=${agentId}`);

    return json({
      session_token: sessionToken,
      expires_at: expiresAt,
      allowed_ops: ops,
      service_name: "MedGraph",
      service_rules: {
        read_only: true,
        retention: "session_only",
        rate_limit: { requests: 30, window_seconds: 60 },
      },
    });
  } catch (err) {
    console.error("[agent-authorize] unexpected_error");
    return json({ error: "Internal server error" }, 500);
  }
});
