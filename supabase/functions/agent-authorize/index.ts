// =============================================================================
// MedGraph — agent-authorize Edge Function
// =============================================================================
// Now enforces NHB consent proof + dynamic CARD Set template fetched from
// opn.li. The hardcoded service rules are retained only as a structural
// fallback (e.g. nhbInvitation shape) — runtime validation uses the template.
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  createSessionToken,
  defineServiceRules,
  validateCardSet,
} from "https://raw.githubusercontent.com/mikeoz/human-consent-layer/1b65e02/packages/card-receiver/deno/src/index.ts";

// ----------------------------------------------------------------------------
// Supabase service-role client (writes to agent_sessions)
// ----------------------------------------------------------------------------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "agent-authorize: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set",
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ----------------------------------------------------------------------------
// opn.li template source
// ----------------------------------------------------------------------------
const OPN_SUPABASE_URL = "https://qmpmxrtcysrngfjotkcq.supabase.co";
const OPN_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtcG14cnRjeXNybmdmam90a2NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDI1NzQsImV4cCI6MjA4NjU3ODU3NH0.JGzxUDz1RsQCCXQPUWI2B5gkMBSu_ZTZ5geofGLF6Ls";
const MEDGRAPH_ENTITY_ID =
  Deno.env.get("MEDGRAPH_ENTITY_ID") ?? "e695da45-3cac-4754-800d-1df66bf0697c";

// ----------------------------------------------------------------------------
// Structural fallback rules (retained for nhbInvitation shape)
// ----------------------------------------------------------------------------
const { policy, cardStack, nhbInvitation } = defineServiceRules({
  serviceName: "MedGraph",
  serviceId: "medgraph-001",
  minimumShieldLevel: "green",
  allowedResources: ["medical_records"],
  maxAccessLevel: "read",
  allowedActions: ["summarize", "search", "compare"],
  rateLimit: { requestsPerWindow: 30, windowSeconds: 60 },
  retention: "session_only",
  sessionTtlSeconds: 3600,
  nhbSummary: {
    entity: "BigCROC (your CROCbox AI agent)",
    data: "Your medical records stored in MedGraph",
    use: "Read and summarize your lab results",
    boundary: "This session only — no data retained",
  },
});

// ----------------------------------------------------------------------------
// HTTP handler
// ----------------------------------------------------------------------------
serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed; POST required" });
  }

  // ── Parse body ────────────────────────────────────────────────
  let body: { cardSet?: any; consent_proof?: any };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Body must be valid JSON" });
  }

  const cardSet = body?.cardSet;
  if (!cardSet || typeof cardSet !== "object") {
    return jsonResponse(400, {
      error: "Body must include a 'cardSet' object",
      hint: "Build the CARD Set from templates/medgraph-health.json",
    });
  }

  // ── Consent proof check ───────────────────────────────────────
  // For the MVP, we trust the consent proof structurally (presence +
  // well-formed). A future enhancement will verify the audit_hash
  // against the chain.
  // TODO: verify audit_hash against opn.li chain for tamper-proof consent verification
  const consent_proof = body?.consent_proof;
  if (
    !consent_proof ||
    typeof consent_proof !== "object" ||
    consent_proof.allowed !== true ||
    typeof consent_proof.decision_id !== "string" ||
    consent_proof.decision_id.length === 0 ||
    typeof consent_proof.audit_hash !== "string" ||
    consent_proof.audit_hash.length === 0
  ) {
    return jsonResponse(403, {
      errors: ["consent_proof_invalid: NHB approval is required"],
    });
  }

  // ── Fetch active CARD Set template from opn.li ────────────────
  let template: any;
  try {
    const templateRes = await fetch(
      `${OPN_SUPABASE_URL}/rest/v1/card_set_templates?entity_id=eq.${MEDGRAPH_ENTITY_ID}&status=eq.active&limit=1`,
      {
        headers: {
          apikey: OPN_ANON_KEY,
          Authorization: `Bearer ${OPN_ANON_KEY}`,
        },
      },
    );
    if (!templateRes.ok) {
      console.error(
        "[agent-authorize] template fetch failed:",
        templateRes.status,
      );
      return jsonResponse(503, {
        error: "No active CARD Set template found",
      });
    }
    const templates = await templateRes.json();
    if (!Array.isArray(templates) || templates.length === 0) {
      return jsonResponse(503, {
        error: "No active CARD Set template found",
      });
    }
    template = templates[0];
  } catch (err) {
    console.error("[agent-authorize] template fetch threw:", err);
    return jsonResponse(503, {
      error: "No active CARD Set template found",
    });
  }

  // ── Validate cardSet against template ─────────────────────────
  const tplUse = template?.use_card ?? {};
  const tplData = template?.data_card ?? {};
  const tplEntity = template?.entity_card ?? {};
  const tplBoundary = template?.boundary_card ?? {};

  const permitted: string[] = Array.isArray(tplUse.permitted)
    ? tplUse.permitted
    : [];
  const prohibited: string[] = Array.isArray(tplUse.prohibited)
    ? tplUse.prohibited
    : [];

  const csUse = (cardSet as any).use_card ?? {};
  const csData = (cardSet as any).data_card ?? {};
  const csEntity = (cardSet as any).entity_card ?? {};
  const csPermitted: string[] = Array.isArray(csUse.permitted)
    ? csUse.permitted
    : [];

  // 1. subset of template's permitted
  const notPermitted = csPermitted.filter((a) => !permitted.includes(a));
  if (notPermitted.length > 0) {
    return jsonResponse(403, {
      errors: [
        `use_card_invalid: actions not permitted by template: ${notPermitted.join(", ")}`,
      ],
    });
  }

  // 2. no prohibited actions
  const usesProhibited = csPermitted.filter((a) => prohibited.includes(a));
  if (usesProhibited.length > 0) {
    return jsonResponse(403, {
      errors: [
        `use_card_invalid: actions prohibited by template: ${usesProhibited.join(", ")}`,
      ],
    });
  }

  // 3. data_type must match
  if (tplData.data_type && csData.data_type !== tplData.data_type) {
    return jsonResponse(403, {
      errors: [
        `data_card_invalid: data_type must be '${tplData.data_type}'`,
      ],
    });
  }

  // 4. entity_card required fields
  const requiredEntityFields: string[] = Array.isArray(tplEntity.required)
    ? tplEntity.required
    : Object.keys(tplEntity).filter(
        (k) => k !== "required" && tplEntity[k] === "required",
      );
  const missingEntityFields = requiredEntityFields.filter(
    (f) => !csEntity || csEntity[f] === undefined || csEntity[f] === null || csEntity[f] === "",
  );
  if (missingEntityFields.length > 0) {
    return jsonResponse(403, {
      errors: [
        `entity_card_invalid: missing required fields: ${missingEntityFields.join(", ")}`,
      ],
    });
  }

  // ── Resolve patient_email → MedGraph user_id ──────────────────
  const patientEmail = csData.patient_email;
  if (!patientEmail || typeof patientEmail !== "string") {
    return jsonResponse(403, {
      errors: ["data_card_invalid: patient_email is required"],
    });
  }

  const { data: authUsers, error: authErr } =
    await supabase.auth.admin.listUsers();
  let resolvedUserId: string | null = null;
  if (!authErr && authUsers?.users) {
    const matchedUser = authUsers.users.find(
      (u: any) => u.email?.toLowerCase() === patientEmail.toLowerCase(),
    );
    if (matchedUser) {
      resolvedUserId = matchedUser.id;
    }
  }
  if (!resolvedUserId) {
    return jsonResponse(403, {
      errors: [
        "data_card_invalid: patient_email does not match any MedGraph user",
      ],
    });
  }

  // ── Step 1: validateCardSet (policy + VE) ─────────────────────
  // TODO: flip to false for production — VE validation is currently bypassed during staging.
  let validation;
  try {
    const skipVE = Deno.env.get("SKIP_VE_VALIDATION") === "true";

    if (skipVE) {
      console.warn(
        "[agent-authorize] SKIP_VE_VALIDATION is true — bypassing VE entirely",
      );
      validation = {
        valid: true,
        errors: [],
        session_scope: {
          agent_id: csEntity.agent_id || "unknown-agent",
          agent_name: csEntity.agent_name || "Unknown Agent",
          principal_id: resolvedUserId,
          allowed_ops: permitted,
          shield_level: "green",
        },
      };
    } else {
      validation = await validateCardSet(cardSet, policy, {
        veEndpoint: "https://ve-staging.opn.li/v1/verify",
        requireVE: true,
      });
    }
  } catch (err) {
    console.error("[agent-authorize] validateCardSet threw:", err);
    return jsonResponse(403, {
      errors: ["validation_error: card set could not be validated"],
    });
  }

  if (!validation.valid) {
    return jsonResponse(403, { errors: validation.errors ?? ["denied"] });
  }

  // Ensure principal_id reflects resolved MedGraph user
  validation.session_scope!.principal_id = resolvedUserId;

  // ── Step 2: createSessionToken (scoped, persisted) ────────────
  const ttl =
    typeof tplBoundary.ttl === "number" && tplBoundary.ttl > 0
      ? tplBoundary.ttl
      : 60;

  // Build a per-request cardStack that reflects the template's actual scope,
  // so the issued session and audit record match what was approved.
  const dynamicCardStack = {
    ...cardStack,
    allowed_ops: permitted,
    rate_limit: tplBoundary.rate ?? cardStack.rate_limit,
    session_ttl_seconds: ttl,
  };

  // Override allowed_ops on session_scope to match the template
  validation.session_scope!.allowed_ops = permitted;

  let session;
  try {
    session = await createSessionToken(validation.session_scope!, ttl, {
      serviceRules: dynamicCardStack as any,
      persistSession: async (record) => {
        const { error } = await supabase.from("agent_sessions").insert({
          session_token: record.token,
          agent_id: record.agent_id,
          agent_name: record.agent_name,
          user_id: record.principal_id,
          allowed_ops: record.allowed_ops,
          expires_at: record.expires_at,
        });
        if (error) {
          throw new Error("agent_sessions insert failed: " + error.message);
        }
      },
    });
  } catch (err) {
    console.error("[agent-authorize] createSessionToken threw:", err);
    return jsonResponse(500, {
      error: "Session could not be issued; please retry",
    });
  }

  // ── Step 3: Response ──────────────────────────────────────────
  return jsonResponse(200, {
    service_name: "MedGraph",
    service_rules: dynamicCardStack,
    nhb_invitation: nhbInvitation,
    session_token: session.token,
    expires_at: session.expires_at,
    allowed_ops: permitted,
    green_shield_text: template.green_shield_text,
    consent_decision_id: consent_proof.decision_id,
  });
});

// ----------------------------------------------------------------------------
// Helper
// ----------------------------------------------------------------------------
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
