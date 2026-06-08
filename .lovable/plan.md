
# MedGraph Architecture Audit (read-only)

Snapshot taken 2026-06-08. No files or DB rows were modified.

---

## 1. Supabase tables (schema `public`)

All 10 tables have RLS **enabled**. Row counts are live at audit time.

| Table | Rows | Columns (name : type, null, default) |
|---|---:|---|
| `profiles` | 4 | `id` uuid NN; `display_name` text NULL; `created_at` timestamptz NN `now()` |
| `data_sources` | 10 | `id` uuid NN `gen_random_uuid()`; `user_id` uuid NN; `type` enum `data_source_status`-like NN; `name` text NN; `status` enum NN `'pending'`; `created_at` timestamptz NN `now()`; `provider` text NULL; `connection_state` text NN `'disconnected'`; `last_sync_at` timestamptz NULL; `last_sync_status` text NULL; `last_error_code` text NULL; `last_error_at` timestamptz NULL |
| `consent_agreements` | 4 | `id` uuid NN; `user_id` uuid NN; `scope` text NN; `created_at` timestamptz NN `now()` |
| `consent_snapshots` | 4 | `id` uuid NN; `consent_agreement_id` uuid NN; `permissions` jsonb NN; `created_at` timestamptz NN `now()` |
| `provenance` | 18 | `id` uuid NN; `data_source_id` uuid NN; `method` enum NN; `metadata` jsonb NULL; `captured_at` timestamptz NN `now()` |
| `timeline_events` | 23 | `id` uuid NN; `user_id` uuid NN; `event_type` text NN; `event_time` timestamptz NN; `title` text NN; `summary` text NULL; `details` jsonb NULL; `provenance_id` uuid NULL; `consent_snapshot_id` uuid NULL; `created_at` timestamptz NN `now()` |
| `document_artifacts` | 12 | `id` uuid NN; `user_id` uuid NN; `provenance_id` uuid NN; `storage_path` text NN; `content_type` text NN; `created_at` timestamptz NN `now()`; `title` text NULL; `doc_type` text NULL; `occurred_at` timestamptz NULL; `original_filename` text NULL; `file_size` int NULL |
| `audit_events` | 45 | `id` uuid NN; `user_id` uuid NN; `action` text NN; `entity_type` text NN; `entity_id` uuid NN; `created_at` timestamptz NN `now()` |
| `jobs` | 6 | `id` uuid NN; `user_id` uuid NN; `job_type` text NN; `status` enum `job_status` NN; `payload` jsonb NULL; `idempotency_key` text NULL; `created_at` timestamptz NN |
| `agent_sessions` | 8 | `id` uuid NN; `user_id` uuid NN; `agent_id` text NN; `agent_name` text NN `'Unknown Agent'`; `session_token` text NN; `allowed_ops` text[] NN `'{read}'`; `expires_at` timestamptz NN; `created_at` timestamptz NN `now()`; `revoked_at` timestamptz NULL |

No physical foreign keys between public tables — relationships are logical only.

### RLS policies (all scoped to the owning user)

| Table | Policies |
|---|---|
| `profiles` | SELECT/INSERT/UPDATE where `auth.uid() = id` |
| `data_sources` | SELECT/INSERT/UPDATE where `auth.uid() = user_id` |
| `consent_agreements` | SELECT/INSERT where `auth.uid() = user_id` (no UPDATE/DELETE — immutable) |
| `consent_snapshots` | SELECT/INSERT via parent `consent_agreements.user_id = auth.uid()` |
| `provenance` | SELECT/INSERT via parent `data_sources.user_id = auth.uid()` |
| `timeline_events` | SELECT/INSERT where `auth.uid() = user_id` (no UPDATE/DELETE — append-only) |
| `document_artifacts` | SELECT/INSERT where `auth.uid() = user_id` |
| `audit_events` | SELECT/INSERT where `auth.uid() = user_id` |
| `jobs` | SELECT/INSERT/UPDATE where `auth.uid() = user_id` |
| `agent_sessions` | SELECT/UPDATE (revoke) where `auth.uid() = user_id`. No client INSERT — only the service role (via `agent-authorize`) inserts. |

### Enums in use
`data_source_status`, `data_sources.type`, `provenance.method`, `job_status`.

---

## 2. Edge Functions

Base: `https://bntalhlvexmljdqnbjgg.supabase.co/functions/v1/<name>`

| Function | Entry point | What it does | Auth | Deployed |
|---|---|---|---|---|
| `documents-download` | `supabase/functions/documents-download/index.ts` | Streams a user's document from the private `documents` bucket after validating their JWT and ownership of the artifact. | User JWT (self-validated; `verify_jwt = false` in config) | Yes |
| `fasten-demo-sync` | `supabase/functions/fasten-demo-sync/index.ts` | Generates 6 hardcoded "external" timeline events with provenance + consent snapshot, marks the source connected. | User JWT | Yes |
| `dev-create-test-user` | `supabase/functions/dev-create-test-user/index.ts` | Admin-only creation of confirmed test users (gated by `APP_ENV=development` and `TEST_ADMIN_EMAILS` allowlist). | User JWT + email allowlist + env gate | Yes |
| `agent-authorize` | `supabase/functions/agent-authorize/index.ts` | Validates an incoming CARD Set against MedGraph service rules and the Opnli VE, then issues a scoped row in `agent_sessions` and returns a session token. Honors `SKIP_VE_VALIDATION=true` to bypass VE in test. | Public; trust derives from CARD Set + VE | Yes |
| `agent-records-list` | `supabase/functions/agent-records-list/index.ts` | Returns timeline-event summaries for the user bound to a valid agent session token; supports event-type / date / limit filters. | `session_token` validated against `agent_sessions` | Yes |
| `agent-records-detail` | `supabase/functions/agent-records-detail/index.ts` | Returns full event detail + signed document URL (15 min) for one event, scoped to the session's user. | `session_token` | Yes |

All six are registered in `supabase/config.toml` with `verify_jwt = false` (each function does its own auth check).

---

## 3. App routes (`src/App.tsx`)

| Path | Component | Layout | Requires sign-in |
|---|---|---|---|
| `/auth` | `Auth` | none | No |
| `/` | `RootGate` | none | Gate — redirects to `/home` or `/auth` |
| `/home` | `Home` | `AppLayout` | Yes (de-facto via RootGate; pages assume a session) |
| `/journal` | `Journal` | `AppLayout` | Yes |
| `/timeline` | `Timeline` | `AppLayout` | Yes |
| `/event/:id` | `EventDetails` | `AppLayout` | Yes |
| `/documents` | `Documents` | `AppLayout` | Yes |
| `/sources` | `Sources` | `AppLayout` | Yes |
| `/sources/:id` | `SourceDetails` | `AppLayout` | Yes |
| `/share-preview` | `SharePreview` | `AppLayout` | Yes |
| `/consent` | `Consent` | `AppLayout` | Yes |
| `/settings` | `Settings` | `AppLayout` | Yes |
| `/admin` | `Admin` | `AppLayout` | Yes + dev-only UI (`VITE_APP_ENV=development`) |
| `/docs/guardrails` | `Guardrails` | `AppLayout` | Yes |
| `*` | `NotFound` | none | No |

There is no route-guard HOC — the auth check lives in `RootGate` and pages rely on RLS to return nothing for unauthenticated requests.

---

## 4. Auth model

- **Provider:** Supabase Auth, email + password only. **No** OAuth (Google, Apple, etc.), no magic link, no phone.
- **Sign-up flow:** `Auth.tsx` calls `supabase.auth.signUp` with `emailRedirectTo: window.location.origin` and `display_name` in user metadata. Real signups would require email confirmation.
- **Test users:** Created via the `dev-create-test-user` Edge Function using `admin.createUser({ email_confirm: true })`, so they bypass the verification email.
- **Profile creation:** `public.handle_new_user()` exists as a SECURITY DEFINER function but **no trigger is attached to `auth.users`** — organic signups will not get a `profiles` row automatically. The dev function inserts the profile manually.
- **Session management (frontend):** A single client at `src/integrations/supabase/client.ts` with `persistSession: true`, `autoRefreshToken: true`, `storage: localStorage`. `RootGate` calls `supabase.auth.getSession()` once on `/` and redirects.
- **Roles:** None. No `user_roles` table, no `has_role` function. "Admin" in the UI is just dev-mode gating (`import.meta.env.DEV || VITE_APP_ENV==='development'`) plus the email allowlist inside `dev-create-test-user`.
- **Agent auth (separate trust domain):** CARD-Carrying Agents authenticate to `agent-authorize` with a CARD Set, receive a session token persisted in `agent_sessions` (TTL 1h, `allowed_ops`, optional `revoked_at`), and present that token to `agent-records-list` / `agent-records-detail`. Agents never use a user JWT.

---

## 5. Data shape — where health data lives

Everything is **append-only and immutable** by design. There is one canonical event stream (`timeline_events`) plus provenance, consent, and (for files) a storage object.

| Data kind | Where it lives | How it's linked to the user |
|---|---|---|
| User-authored journal entries | `timeline_events` rows with `event_type = 'journal_entry'` | `timeline_events.user_id = auth.uid()` |
| Externally synced records (Fasten demo) | `timeline_events` rows with `event_type = 'external_event'`, `details.is_demo = true`, linked to a `provenance` row whose `data_source_id` belongs to the user | `timeline_events.user_id`, `provenance.data_source_id → data_sources.user_id` |
| Visit summaries / amendments | `timeline_events` rows with `event_type` of `visit_summary` or `event_amended` (amendments reference the original event in `details`) | `timeline_events.user_id` |
| Uploaded documents — binary | Private Supabase Storage bucket `documents`, path prefix `<user_id>/...` (storage policies enforce path = `auth.uid()`) | path prefix is the user's UUID |
| Uploaded documents — metadata | `document_artifacts` row (storage_path, content_type, filename, size, doc_type, title, occurred_at) | `document_artifacts.user_id` |
| Document → timeline link | Each upload also inserts a `timeline_events` row with `event_type = 'document_uploaded'` sharing the same `provenance_id` as the artifact | both rows carry `user_id` |
| Provenance (how the data arrived) | `provenance` (method enum: `portal_import`, `manual_entry`, etc., + jsonb `metadata`) | via `data_source_id → data_sources.user_id` |
| Consent at capture time | `consent_agreements` (per scope) + `consent_snapshots` (jsonb permissions at the moment of ingest); each event's `consent_snapshot_id` pins what was permitted then | via `consent_agreements.user_id` |
| Audit trail | `audit_events` (action + entity, no PHI) | `audit_events.user_id` |
| Background work | `jobs` (status enum, jsonb payload) | `jobs.user_id` |
| Agent sessions (non-user identity) | `agent_sessions` (token, agent_id/name, allowed_ops, expires_at) | `agent_sessions.user_id` = the user whose data the agent is scoped to |

There are **no parsed-record, summary, or LLM-derived tables** — the project does no AI/LLM processing. Document content is never extracted into structured tables; it stays as the original file in storage plus the artifact metadata row.

Storage bucket inventory: only `documents` (private). Storage policies on `storage.objects` for that bucket enforce `auth.uid()::text = storage.foldername(name)[1]` on SELECT / INSERT / UPDATE / DELETE.

---

## 6. External integrations

| Integration | Surface | Status |
|---|---|---|
| **Fasten Health — Stitch web component** | `<fasten-stitch-element>` loaded in `index.html` from `https://cdn.fastenhealth.com/connect/v4/`, mounted in `src/components/sources/FastenStitchWidget.tsx` with public ID `public_test_vjql828oy61awhvrk4o2cq822379hx7n3ypdmd91ooolj` | Widget renders and emits events to its event bus, but the component only logs them — **no ingestion pipeline is wired**. |
| **Fasten Health — demo sync** | `fasten-demo-sync` Edge Function | Active path: generates 6 hardcoded events. No real network call to Fasten. |
| **Opnli Verification Endpoint (VE)** | `agent-authorize` calls `https://ve-staging.opn.li/v1/verify` via the `human-consent-layer` SDK (Deno import pinned to GitHub commit `1b65e02`) | Live HTTP dependency. Currently bypassable via `SKIP_VE_VALIDATION=true` because the VE is in a pre-convergence state. |
| **human-consent-layer SDK** | Deno import from `raw.githubusercontent.com/mikeoz/human-consent-layer/1b65e02/...` | Used only inside `agent-authorize`. |
| **Lovable AI Gateway** | Secret `LOVABLE_API_KEY` is provisioned | Not called by any function or page in the current code. |

No Stripe, no analytics, no email/SMS provider, no webhooks, no other third-party APIs. `package.json` has no non-Supabase backend SDKs.

---

## 7. Notable gaps observed (informational only — not a fix request)

1. `auth.users` has no trigger calling `handle_new_user()`, so organic email signups will not get a `profiles` row.
2. No `user_roles` table — all role gating is environment-based (`VITE_APP_ENV`) or email-allowlist inside the dev function.
3. `consent_snapshots.permissions` is recorded but never consulted as an authorization filter on reads (agent functions only check `allowed_ops` on the session, not the consent snapshot on each event).
4. The Fasten Stitch widget is loaded but its real-ingest path is not wired — the only working sync is the 6-event demo stub.
5. `SKIP_VE_VALIDATION=true` is currently set, so `agent-authorize` issues sessions without VE verification. Acceptable for staging; must be flipped off for production.
6. No physical foreign keys between public tables — referential integrity is enforced only by application code and RLS predicates.
