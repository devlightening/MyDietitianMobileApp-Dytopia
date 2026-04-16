-- Migration: Add Code column to AccessKeys table for 6-digit access codes
-- Date: 2026-02-16
-- Purpose: Enable easy client premium activation with short codes instead of GUIDs

-- Add Code column
ALTER TABLE "AccessKeys" 
ADD COLUMN "Code" VARCHAR(8);

-- Create unique index on Code
CREATE UNIQUE INDEX "IX_AccessKeys_Code" 
ON "AccessKeys" ("Code") 
WHERE "Code" IS NOT NULL;

-- Add index for faster code lookups
CREATE INDEX "IX_AccessKeys_Code_Active" 
ON "AccessKeys" ("Code", "IsActive") 
WHERE "Code" IS NOT NULL AND "IsActive" = true;

-- Backfill existing access keys with codes (optional - can be done gradually)
-- UPDATE "AccessKeys" 
-- SET "Code" = SUBSTRING(MD5(RANDOM()::text), 1, 6)
-- WHERE "Code" IS NULL;

COMMENT ON COLUMN "AccessKeys"."Code" IS 'User-facing 6-8 digit access code for easy premium activation';
