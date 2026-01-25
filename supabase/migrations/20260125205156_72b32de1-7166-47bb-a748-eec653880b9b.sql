-- Add 'external_api' to data_source_type enum for Fasten and other external integrations
ALTER TYPE data_source_type ADD VALUE IF NOT EXISTS 'external_api';

-- Add 'device' to data_source_type enum if not exists (for Apple Health)
ALTER TYPE data_source_type ADD VALUE IF NOT EXISTS 'device';