-- Add 'manual_amendment' to provenance_method enum
ALTER TYPE public.provenance_method ADD VALUE IF NOT EXISTS 'manual_amendment';