# MyBödy → MedGraph Pre-Integration Audit

Read-only audit. **No code or database changes were made.** Findings as of 2026-04-27.

---

## 1. Data API Surface

### Edge Functions (the only server-side endpoints)

Base URL pattern: `https://bntalhlvexmljdqnbjgg.supabase.co/functions/v1/<name>`

| Function | Method | Auth | Returns |
|---|---|---|---|
| `documents-download` | `GET` (query: `?artifact_id=<uuid>`) | JWT required (validated in code via `getClaims`); `verify_jwt = false` in config so the function self-validates | Binary file stream with `Content-Type` from artifact, `Content-Disposition: attachment; filename=...`. RLS-scoped to `user_id = auth.uid()`. |
| `fasten-demo-sync` | `POST` (body: `{ source_id }`) | JWT required (validated via `auth.getUser()` using user's bearer token) | `{ success: true, imported_count: number }`. Side effect: inserts `consent_agreement` (if missing), `consent_snapshot`, `provenance`, 6 `timeline_events`, `audit_event`; updates `data_sources.connection_state = 'connected'`. |
| `dev-create-test-user` | `POST` | JWT + email allowlist (`TEST_ADMIN_EMAILS`) + `APP_ENV === 'development'` | `{ ok: true, userId }`. Creates auth user via service role. |

### Frontend → Database (PostgREST, no API layer)

There is **no `GET /api/records` or `GET /api/records/:id`**. The frontend talks directly to PostgREST through `supabase.from('<table>').select(...)`, relying on RLS. Tables read from the client include `timeline_events`, `document_artifacts`, `data_sources`, `provenance`, `consent_agreements`, `consent_snapshots`, `audit_events`, `jobs`, `profiles`. Documents binary content is the only thing fetched through an Edge Function (`documents-download`); everything else is direct PostgREST.

**Closest existing pattern to a "records list" endpoint:** the Timeline page query — `supabase.from('timeline_events').select('*').eq('user_id', auth.uid()).order('event_time')` — executed in-browser with the user's JWT. There is no server-side authorization layer beyond Postgres RLS.

---

## 2. Supabase Tables — Current State

All 9 expected tables exist in `public`. **No additional public tables found.** Live row counts:

| Table | Rows | Key columns | RLS |
|---|---:|---|---|
| `profiles` | 3 | `id` (uuid, = auth.uid()), `display_name`, `created_at` | SELECT/INSERT/UPDATE own; no DELETE |
| `data_sources` | 9 | `id`, `user_id`, `name`, `type` (enum), `status` (enum, default `pending`), `provider`, `connection_state` (default `disconnected`), `last_sync_at`, `last_sync_status`, `last_error_code`, `last_error_at`, `created_at` | SELECT/INSERT/UPDATE own; no DELETE |
| `consent_agreements` | 3 | `id`, `user_id`, `scope` (text), `created_at` | SELECT/INSERT own; no UPDATE/DELETE |
| `consent_snapshots` | 3 | `id`, `consent_agreement_id`, `permissions` (jsonb), `created_at` | SELECT/INSERT via parent agreement ownership; no UPDATE/DELETE |
| `provenance` | 14 | `id`, `data_source_id`, `method` (enum), `metadata` (jsonb), `captured_at` | SELECT/INSERT via parent data_source ownership; no UPDATE/DELETE |
| `timeline_events` | 19 | `id`, `user_id`, `event_type` (text), `event_time`, `title`, `summary`, `details` (jsonb), `provenance_id`, `consent_snapshot_id`, `created_at` | SELECT/INSERT own; **no UPDATE/DELETE — append-only / immutable** |
| `document_artifacts` | 8 | `id`, `user_id`, `provenance_id`, `storage_path`, `original_filename`, `content_type`, `file_size`, `doc_type`, `title`, `occurred_at`, `created_at` | SELECT/INSERT own; no UPDATE/DELETE |
| `audit_events` | 30 | `id`, `user_id`, `entity_id`, `entity_type`, `action`, `created_at` | SELECT/INSERT own; no UPDATE/DELETE |
| `jobs` | 6 | `id`, `user_id`, `job_type`, `status` (enum, default `pending`), `payload` (jsonb), `idempotency_key`, `created_at` | SELECT/INSERT/UPDATE own; no DELETE |

**No physical foreign keys** between public tables — relationships are logical only (matches data_model memory).

Enum types in use (`USER-DEFINED`): `data_source_status`, `data_sources.type`, `provenance.method`, `job_status`. (No `consent_decisions` or member-related tables exist.)

---

## 3. Storage Buckets

| Bucket | Public | Contents |
|---|---|---|
| `documents` | No (private) | User-uploaded documents, keyed by path prefix `<user_id>/...` |

Storage policies on `storage.objects` for the `documents` bucket:
- **SELECT** — `bucket_id = 'documents' AND auth.uid()::text = storage.foldername(name)[1]`
- **INSERT** — same predicate (with check)
- **UPDATE** — same predicate
- **DELETE** — same predicate

Path-prefix isolation: each user can only touch objects under their own `user_id/` folder.

---

## 4. Authentication & User State

- **Users:** 3 accounts in `auth.users`:
  - `harriethumble@testco.com` (created 2026-01-24)
  - `bobbethany@testco.com` (created 2026-01-24)
  - `barbbaker@testco.com` (created 2026-02-09)
- **Method:** Email/password only (provider = `email`). **No Google or other OAuth configured.**
- **Auto-confirm:** Effectively yes — all 3 users have `email_confirmed_at` populated at the same instant as `created_at` (admin-created via `dev-create-test-user` edge function with `email_confirm: true`). Standard signup flow in `Auth.tsx` does set `emailRedirectTo`, so real signups would receive a verification email — but no real-user signups have occurred yet.
- **Root auth gate:** ✅ Present. `src/pages/RootGate.tsx` is mounted at `/` in `App.tsx`. It calls `supabase.auth.getSession()` and redirects to `/home` if signed in or `/auth` if not.
- **Profile creation trigger:** `handle_new_user()` SECURITY DEFINER function exists, but **no trigger is currently attached to `auth.users`** (the audit confirmed zero triggers in the database). Profiles are created either by the `dev-create-test-user` function or implicitly never for organic signups — this is a latent bug.

---

## 5. Current Branding & Navigation

### "MyBödy" appears in:

| File | Line | Context |
|---|---|---|
| `src/pages/Auth.tsx` | 96 | Auth screen heading `<h1>MyBödy</h1>` |
| `src/pages/Home.tsx` | 82 | "Welcome to MyBödy" |
| `src/components/layout/AppSidebar.tsx` | 60–66 | Sidebar logo: `M` avatar + "MyBödy" wordmark |
| `src/components/layout/AppLayout.tsx` | 48 | Mobile header brand label |
| `src/pages/docs/Guardrails.tsx` | 7, 17 | "MyBödy Guardrails" doc page |
| `src/pages/Consent.tsx` | 31 | Body copy "Before using MyBödy…" |
| `src/lib/safe-logger.ts` | 77, 80, 83, 86 | Console log prefix `[MyBödy]` |
| `src/index.css` | 5 | Comment "MyBödy Design System" |
| `src/config/env.ts` | 14 | Comment |
| `index.html` | 7, 8, 11–13 | Title still **`<title>Lovable App</title>`**, og tags also still default Lovable values — not branded as MyBödy at all |
| `README.md` | — | (likely default; not inspected in detail) |

**No logo image assets** — only the literal letter "M" in a colored rounded square (`bg-primary`) acts as the logo, in the sidebar header.

### Navigation

Sidebar (`AppSidebar.tsx`) groups:
- **Health Data**: Home, Timeline, Documents, Sources, Consent
- **Account**: Settings
- **Developer** (only when `import.meta.env.DEV` or `VITE_APP_ENV=development`): Admin / Debug, Guardrails

Top header (`AppLayout.tsx`): sidebar trigger, mobile "MyBödy" label, mobile home shortcut, user dropdown with **Log out**.

### Routes (`App.tsx`)

`/auth`, `/` (RootGate), `/home`, `/journal`, `/timeline`, `/event/:id`, `/documents`, `/sources`, `/sources/:id`, `/share-preview`, `/consent`, `/settings`, `/admin`, `/docs/guardrails`, `*` → NotFound.

### URLs
- Preview: `https://id-preview--6ad78c79-5aff-4ae5-bfc1-7c59765066ff.lovable.app`
- Published: `https://mybody-care-connect.lovable.app`
- Custom domains: none

---

## 6. External Integrations

### Fasten Health — **mixed state**

1. **Demo-only stub (active path):** `fasten-demo-sync` Edge Function generates 6 hardcoded events (encounter, CBC, lipid panel, lisinopril, follow-up, chest X-ray) and writes them as `timeline_events` with `event_type='external_event'` and `details.is_demo=true`. This is what currently runs when a user "syncs" a Fasten source. Provenance method is `portal_import`.

2. **Real Fasten Stitch web component (UI-only, not yet wired to backend):** `index.html` loads `https://cdn.fastenhealth.com/connect/v4/fasten-stitch-element.{js,css}`. `src/components/sources/FastenStitchWidget.tsx` renders `<fasten-stitch-element public-id="public_test_vjql828oy61awhvrk4o2cq822379hx7n3ypdmd91ooolj" />` and listens for `eventBus` events but **only logs them** — no callback into our backend, no token exchange, no real ingestion pipeline. It's mounted on `SourceDetails`.

So real Fasten OAuth/Stitch is **not** wired — the Stitch widget is loaded and visible, but its events are not converted into `timeline_events`. The active ingestion path is still the demo stub.

### Other external APIs
None. No Stripe, no third-party APIs, no webhooks. No Lovable AI calls.

### Edge Functions deployed
1. `documents-download` — proxy file download with RLS check
2. `fasten-demo-sync` — generates 6 demo timeline events
3. `dev-create-test-user` — admin/dev-only test-user provisioning

---

## 7. Features Assessment

| Feature | Status |
|---|---|
| Journal entry creation | ✅ Working — `JournalEntryForm.tsx`, writes to `timeline_events` (`event_type='journal_entry'`) + audit |
| Document upload | ✅ Working — `DocumentUploadForm.tsx` uploads to `documents` bucket then inserts `provenance` + `document_artifacts` + `timeline_events` (`event_type='document_uploaded'`) with rollback on failure |
| Document download | ✅ Working — via `documents-download` Edge Function proxy |
| Timeline with filters | ✅ Present — `TimelineFilters.tsx` (All / Journal / Documents / External) |
| Event Details page | ✅ Working — `/event/:id` (`EventDetails.tsx`) |
| Amendment flow (`event_amended`) | ✅ Working — `AmendmentModal.tsx`, `AmendmentsList.tsx`; appends new immutable event referencing original |
| Review Mode (checkbox selection) | ✅ Present — `ReviewModeToggle.tsx`, `SelectableEventCard.tsx`, `ReviewModeActions.tsx` |
| Visit Summary creation | ✅ Present — `VisitSummaryModal.tsx` (creates `visit_summary` event) |
| Share Preview (read-only) | ✅ Present — `/share-preview` route, navigated to with selected events in router state; logs `share_preview_viewed` audit |
| **Consent-Scoped Sharing (MBLP 2.005)** | ⚠️ **Not completed.** `consent_snapshots` are created during ingestion (Fasten sync, document upload) and stamped onto each event, but there is **no UI or logic that filters/redacts `timeline_events` by `consent_snapshot.permissions` for sharing**. Share Preview just shows whatever was selected. No consent-scope enforcement layer exists. |
| Sources page with Fasten demo | ✅ Working — `Sources.tsx`, `SourceDetails.tsx` (with Stitch widget mounted) |
| Admin/Debug page | ✅ Present — `Admin.tsx` with `TestUsersPanel.tsx`; visible only in dev mode |
| Logout | ✅ Working — header user menu in `AppLayout.tsx` |

---

## 8. Summary Paragraph

MyBödy is a working personal health-record app with three live test users. It lets a signed-in user (email/password only) create journal entries, upload documents to a private storage bucket, and trigger a stubbed "Fasten" sync that synthesizes six demo external health events. All inputs become immutable, append-only `timeline_events` stamped with `provenance` (origin/method) and `consent_snapshot` (permissions at capture time), and corrections are added as separate `event_amended` events rather than mutations. Reviewable Timeline, Event Details, Amendment, Review-Mode selection, Visit Summary, and a read-only Share Preview are all functional. The Fasten Stitch web component is loaded into `index.html` and rendered on the Source Details page, but its events are only logged — real external ingestion is still the 6-event demo stub. **The single most significant limitation for the MedGraph/Opnli phase is that there is no server-side data API**: the frontend reads everything directly from PostgREST under the user's own JWT, and `consent_snapshots.permissions` are recorded but never enforced as an authorization filter on reads. To let an external AI agent retrieve records under controlled, consent-scoped access, the project will need (a) a real API surface (Edge Functions like `GET /records`, `GET /records/:id`) that authenticates the agent (not the user), (b) a consent-decision layer that gates each read against the relevant `consent_snapshot`, and (c) a way to map agent identities to permitted scopes — none of which exists today.

---

## Notable issues worth flagging before MedGraph work

1. `index.html` `<title>` and og tags still say "Lovable App" — never re-branded.
2. No trigger on `auth.users` to call `handle_new_user()`, so organic signups won't auto-create a `profiles` row.
3. No Google/OAuth — only email/password. If MedGraph wants Google sign-in, it must be added.
4. Logical FKs only — no DB-level referential integrity between `timeline_events`, `provenance`, `consent_snapshots`, `data_sources`, `document_artifacts`.
5. `consent_snapshots.permissions` jsonb is currently free-form and never read for authorization decisions.
