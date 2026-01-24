-- Add columns to data_sources for source management
-- These columns support connection state tracking and sync status

ALTER TABLE public.data_sources 
ADD COLUMN IF NOT EXISTS provider text NULL,
ADD COLUMN IF NOT EXISTS connection_state text NOT NULL DEFAULT 'disconnected',
ADD COLUMN IF NOT EXISTS last_sync_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS last_sync_status text NULL,
ADD COLUMN IF NOT EXISTS last_error_code text NULL,
ADD COLUMN IF NOT EXISTS last_error_at timestamptz NULL;

-- Add check constraint for connection_state values
ALTER TABLE public.data_sources 
ADD CONSTRAINT data_sources_connection_state_check 
CHECK (connection_state IN ('disconnected', 'connected', 'error'));

-- Add check constraint for last_sync_status values
ALTER TABLE public.data_sources 
ADD CONSTRAINT data_sources_last_sync_status_check 
CHECK (last_sync_status IS NULL OR last_sync_status IN ('never', 'ok', 'error'));

-- Add payload column to jobs table for storing sync request details
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS payload jsonb NULL DEFAULT '{}'::jsonb;