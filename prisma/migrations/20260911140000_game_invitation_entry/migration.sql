-- Preserve accepted invitation entry independently of the source room lifecycle.
-- Historical games have no evidence of link entry and remain unattributed.
ALTER TABLE "GameRun" ADD COLUMN "invitedPlayerIds" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
