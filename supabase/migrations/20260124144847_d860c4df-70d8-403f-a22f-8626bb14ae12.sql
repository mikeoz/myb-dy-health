-- MBLP 1.002: Schema additions for Journal and Document Upload

-- 1. Add missing columns to timeline_events
ALTER TABLE public.timeline_events
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}';

-- 2. Add missing columns to document_artifacts
ALTER TABLE public.document_artifacts
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS doc_type TEXT,
ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS original_filename TEXT;

-- 3. Add metadata column to provenance for non-PHI context
ALTER TABLE public.provenance
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 4. Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage RLS policies for documents bucket
-- Users can only access their own documents (stored in {userId}/ folder)

-- Policy: Users can view their own documents
CREATE POLICY "Users can view own documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can upload to their own folder
CREATE POLICY "Users can upload own documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can update their own documents
CREATE POLICY "Users can update own documents"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own documents
CREATE POLICY "Users can delete own documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);