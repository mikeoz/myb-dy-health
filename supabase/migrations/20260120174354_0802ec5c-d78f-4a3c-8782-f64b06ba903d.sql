-- Core enums for type safety
CREATE TYPE public.data_source_type AS ENUM ('manual', 'upload', 'portal');
CREATE TYPE public.data_source_status AS ENUM ('active', 'inactive', 'pending');
CREATE TYPE public.provenance_method AS ENUM ('manual_entry', 'upload', 'portal_import');
CREATE TYPE public.job_status AS ENUM ('pending', 'running', 'complete', 'failed');

-- 1. profiles - Represents authenticated user
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- 2. data_sources - Represents a source of data
CREATE TABLE public.data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type data_source_type NOT NULL,
    name TEXT NOT NULL,
    status data_source_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data_sources"
    ON public.data_sources FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data_sources"
    ON public.data_sources FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own data_sources"
    ON public.data_sources FOR UPDATE
    USING (auth.uid() = user_id);

-- 3. consent_agreements - Represents user's consent intent
CREATE TABLE public.consent_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scope TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.consent_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own consent_agreements"
    ON public.consent_agreements FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own consent_agreements"
    ON public.consent_agreements FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- No update policy - consent agreements are append-only after creation

-- 4. consent_snapshots - Immutable snapshots of consent at time of use
CREATE TABLE public.consent_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consent_agreement_id UUID NOT NULL REFERENCES public.consent_agreements(id) ON DELETE RESTRICT,
    permissions JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.consent_snapshots ENABLE ROW LEVEL SECURITY;

-- Users can view snapshots through consent_agreements they own
CREATE POLICY "Users can view own consent_snapshots"
    ON public.consent_snapshots FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.consent_agreements ca
            WHERE ca.id = consent_snapshots.consent_agreement_id
            AND ca.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert consent_snapshots for own agreements"
    ON public.consent_snapshots FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.consent_agreements ca
            WHERE ca.id = consent_agreement_id
            AND ca.user_id = auth.uid()
        )
    );

-- NO update or delete policies - consent_snapshots are IMMUTABLE

-- 5. provenance - Tracks origin of data
CREATE TABLE public.provenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id UUID NOT NULL REFERENCES public.data_sources(id) ON DELETE RESTRICT,
    method provenance_method NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.provenance ENABLE ROW LEVEL SECURITY;

-- Users can view provenance through data_sources they own
CREATE POLICY "Users can view own provenance"
    ON public.provenance FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.data_sources ds
            WHERE ds.id = provenance.data_source_id
            AND ds.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert provenance for own data_sources"
    ON public.provenance FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.data_sources ds
            WHERE ds.id = data_source_id
            AND ds.user_id = auth.uid()
        )
    );

-- 6. timeline_events - Immutable health-related events
CREATE TABLE public.timeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provenance_id UUID NOT NULL REFERENCES public.provenance(id) ON DELETE RESTRICT,
    consent_snapshot_id UUID NOT NULL REFERENCES public.consent_snapshots(id) ON DELETE RESTRICT,
    event_type TEXT NOT NULL,
    event_time TIMESTAMPTZ NOT NULL,
    summary TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own timeline_events"
    ON public.timeline_events FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own timeline_events"
    ON public.timeline_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- NO update or delete policies - timeline_events are IMMUTABLE

-- 7. document_artifacts - References uploaded files (metadata only)
CREATE TABLE public.document_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provenance_id UUID NOT NULL REFERENCES public.provenance(id) ON DELETE RESTRICT,
    storage_path TEXT NOT NULL,
    content_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.document_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own document_artifacts"
    ON public.document_artifacts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own document_artifacts"
    ON public.document_artifacts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 8. audit_events - Tracks system actions (NO PHI)
CREATE TABLE public.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit_events"
    ON public.audit_events FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own audit_events"
    ON public.audit_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- NO update or delete policies - audit_events are IMMUTABLE

-- 9. jobs - Represents async work
CREATE TABLE public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL,
    status job_status NOT NULL DEFAULT 'pending',
    idempotency_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, idempotency_key)
);
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs"
    ON public.jobs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own jobs"
    ON public.jobs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Jobs can ONLY update status field
CREATE POLICY "Users can update own job status"
    ON public.jobs FOR UPDATE
    USING (auth.uid() = user_id);

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, created_at)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name', now());
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();