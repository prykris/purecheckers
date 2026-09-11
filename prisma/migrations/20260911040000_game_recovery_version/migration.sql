-- Existing null checkpoints are ambiguous. Only new writers guarantee that no
-- gameplay can be accepted before their first checkpoint commits.
ALTER TABLE "GameRun" ADD COLUMN "recoveryVersion" INTEGER NOT NULL DEFAULT 0;
-- Keep the default at zero: a still-running old binary must not accidentally
-- label its writes as recoverable. New creation code explicitly supplies one.
