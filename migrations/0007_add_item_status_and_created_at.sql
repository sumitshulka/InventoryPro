-- Migration: Add status and createdAt columns to items table
-- Date: 2025-06-12

-- Add status column with default 'active'
ALTER TABLE items ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

-- Add createdAt column with default current timestamp
ALTER TABLE items ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT NOW();

-- Create indexes for the new columns
CREATE INDEX items_status_idx ON items(status);
CREATE INDEX items_created_at_idx ON items(created_at);

-- Update existing items to have 'active' status (already handled by DEFAULT)
-- No additional UPDATE needed since DEFAULT handles existing rows