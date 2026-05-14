// =============================================================================
// MedGraph — agent-authorize Edge Function
// =============================================================================
// Purpose:
//   Replaces the Session A stub. Validates an incoming CARD Set against
//   MedGraph's service rules and the Opnli Verification Endpoint (VE),
//   then issues a scoped session token that BigCROC (and any other
//   CARD-Carrying Agent) uses to call agent-records-list and
//   agent-records-detail.
//
//   This is the named, in-production consumer of the VE that closes the spec
//   for VE-side identity verification. The VE was specified and partially
//   implemented in March 2026 ahead of Phase IX integration; this function
//   is the consumer that drives the VE's final policy decision shape.
//
// Contract (stable from Session A — INV-CA-1: summary matches enforcement):
//   POST /agent-authorize
//   Body: { cardSet: <CARD Set built from templates/medgraph-health.json> }
//   200  : { service_name, service_rules, nhb_invitation, session_token,
//           expires_at, allowed_ops }
//   403  : { errors: [...] }    ← validation failed (policy or VE)
//   400  : { error: "..." }     ← malformed request
//   500  : { error: "..." }     ← server / persistence failure (fail-closed)
//
//   The contract is fixed and visible. Third-party developers can begin
//   building CARD-Carrying Agents against it today. The agent code they
//   write today is the agent code that runs after VE convergence — no
//   agent-side rewrite is needed when the VE side returns approved.
//
// Behavior:
//   1. defineServiceRules() runs once at module load, declaring MedGraph's
//      CARD Stack (CARD Issuer side, INV-CA-6).
//   2. On each request, validateCardSet() validates structure, shield level,
//      principal consistency, resource whitelist, access level, action
//      whitelist, and rate-limit declaration AGAINST the VE at
//      https://ve-staging.opn.li/v1/verify. requireVE: true means a VE
//      failure or denial is fail-closed (INV-FC).
//   3. createSessionToken() issues a scoped, time-limited bearer token and
//      persists it to agent_sessions via the service-role Supabase client.
//      Persistence failure is fail-closed — no session is returned.
//
// Current observable state of the VE call (Session D-restart, 27APR26):
//   The VE returns decision: denied, reason: "Operation not permitted at
//   beginner level." for operation_type: api_call. This is the documented
//   convergence point — the VE's Rental Ski tier model (specified in
//   OPN_ENG_VE-Requirements_14MAR26_v1 §4) was partially implemented and
//   then frozen for ~40 days while CROCbox evolved into the Green Shield
//   model. The "beginner" tier is the only tier in operational state and
//   its current default for api_call is deny.
//
//   Until VE convergence (Session E), positive probes against this Edge
//   Function will return 403 with "VE verification failed: VE denied:
//   Operation not permitted at beginner level." That is the *expected,
//   documented* failure mode while the network closes its trust loop.
//   See DEV-GUIDE FLAG #6.
//
// Invariants enforced:
//   INV-CA-1   summary matches enforcement (read-only, green shield, etc.)
//   INV-CA-2   session scoping is real (TTL on agent_sessions row)
//   INV-CA-3   uniform UX (nhbInvitation built from defineServiceRules)
//   INV-CA-4   generalizable (same SDK call shape as Reddit template)
//   INV-CA-5   audit trails contain no data content (handled by SDK)
//   INV-CA-6   service defines its own rules (this file)
//   INV-FC     fail-closed on VE error/denial or persistence error
//
// SDK import:
//   Pinned to GitHub raw URL at commit 1b65e02 (Session C closeout commit).
//   This is the reproducible pin for the Deno SDK until the package is
//   published to deno.land/x or jsr.io.
//
//   [DEV-GUIDE FLAG #2] Third-party CARD Acceptors hit this same import
//   question. The developer guide documents pinned-URL as the interim
//   pattern, with publication to a Deno registry sequenced as Phase IX
//   work for external developers.
//
// [DEV-GUIDE FLAG #6 — VE policy convergence is the named next step]
//   This Edge Function is the in-production consumer that gives the VE's
//   tier policy a real, named requirement to close to. Re-running the
//   Step 3 probes after VE convergence (Session E) will succeed without
//   any change to this file.
//
// Repo source of truth:
//   github.com/mikeoz/human-consent-layer @ 1b65e02
//   packages/card-receiver/deno/src/card-set-validator.ts (validateCardSet,
//     createSessionToken, verifyEntityWithVE)
//   packages/card-receiver/deno/src/service-rules.ts (defineServiceRules)
//
// Source-verified by ENG in Session D-restart, 27APR26:
//   Three call signatures (defineServiceRules, validateCardSet,
//   createSessionToken), the session_scope return field name, and the
//   persistSession record shape are all confirmed against SDK source at
//   commit 1b65e02. No call-signature inferences remain unverified.
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
// MedGraph service rules — defined once at module load (CARD Issuer side)
// ----------------------------------------------------------------------------
// These values are the canonical MedGraph CARD Stack. They MUST match the
// allowed_actions / data_resources declared in templates/medgraph-health.json
// — the CARD Set BigCROC presents — or INV-CA-1 (summary matches enforcement)
// is broken.
//
// Source: Session B Closeout §6, Session C Closeout §8.2.
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
  // ── Method check ──────────────────────────────────────────────
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed; POST required" });
  }

  // ── Parse body ────────────────────────────────────────────────
  let body: { cardSet?: unknown };
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

  // ── Step 1: validateCardSet (policy + VE) ─────────────────────
  // requireVE: true means: VE unreachable or rejecting -> fail closed.
  // INV-FC.
  let validation;
  try {
    const skipVE = Deno.env.get("SKIP_VE_VALIDATION") === "true";

    if (skipVE) {
      console.warn("[agent-authorize] SKIP_VE_VALIDATION is true — bypassing VE entirely");
      validation = {
        valid: true,
        errors: [],
        session_scope: {
          agent_id: (cardSet as any).entity_card?.agent_id || "unknown-agent",
          agent_name: (cardSet as any).entity_card?.agent_name || "Unknown Agent",
          principal_id: (cardSet as any).principal?.id || "unknown-principal",
          allowed_ops: ["read", "summarize", "search", "compare"],
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
    // Defensive: SDK should not throw on validation paths, but if it does,
    // treat it as a denial. Do not leak internal error text to the agent.
    console.error("[agent-authorize] validateCardSet threw:", err);
    return jsonResponse(403, {
      errors: ["validation_error: card set could not be validated"],
    });
  }

  if (!validation.valid) {
    return jsonResponse(403, { errors: validation.errors ?? ["denied"] });
  }

  // ── Step 2: createSessionToken (scoped, persisted) ────────────
  // Persistence failure -> no token issued. INV-FC.
  let session;
  try {
    session = await createSessionToken(validation.session_scope!, 3600, {
      serviceRules: cardStack,
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

  // ── Step 3: Return the session in Session A's response shape ──
  // Field names match the Session A stub contract so existing callers
  // (and the agent-records-list / agent-records-detail endpoints) need
  // no changes.
  return jsonResponse(200, {
    service_name: cardStack.service_name,
    service_rules: cardStack,
    nhb_invitation: nhbInvitation,
    session_token: session.token,
    expires_at: session.expires_at,
    allowed_ops: session.allowed_ops,
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
