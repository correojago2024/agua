-- Migration: Add is_admin and password fields to resident_subscriptions
-- Run this SQL in your Supabase SQL Editor

-- Add is_admin column to track if a junta member is also an admin
ALTER TABLE resident_subscriptions ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Add password column for individual member passwords
ALTER TABLE resident_subscriptions ADD COLUMN IF NOT EXISTS password TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_resident_subscriptions_building_email 
ON resident_subscriptions(building_id, email);

-- Optional: Add comment to explain the columns
COMMENT ON COLUMN resident_subscriptions.is_admin IS 'If true, this junta member has admin privileges (can add/remove members)';
COMMENT ON COLUMN resident_subscriptions.password IS 'Individual password for this member to login (if empty, building password is used)';