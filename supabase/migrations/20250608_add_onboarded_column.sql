-- Migration: Add onboarded column to profiles table
-- Run this in your Supabase SQL editor to enable the onboarding-skip feature

-- Add onboarded boolean column (defaults to false for new users)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarded BOOLEAN DEFAULT false;

-- Backfill onboarded = true for existing users who have a display_name set
-- (they've effectively completed onboarding already)
UPDATE profiles
SET onboarded = true
WHERE display_name IS NOT NULL
  AND display_name != '';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_onboarded ON profiles(id) WHERE onboarded = true;