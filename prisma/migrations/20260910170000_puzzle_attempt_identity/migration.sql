ALTER TABLE "PuzzleAttempt" ADD COLUMN "revealed" BOOLEAN NOT NULL DEFAULT false;
-- The feature has not been published yet. Preserve any repeated local attempts
-- by merging their strongest progress before enforcing visitor idempotency.
UPDATE "PuzzleAttempt" a SET
  "solved" = merged.solved,
  "attempts" = merged.attempts,
  "hintUsed" = merged.hint_used,
  "rewarded" = merged.rewarded
FROM (
  SELECT MIN(id) AS keep_id, BOOL_OR(solved) AS solved, MAX(attempts) AS attempts,
    BOOL_OR("hintUsed") AS hint_used, BOOL_OR(rewarded) AS rewarded
  FROM "PuzzleAttempt" WHERE "visitorId" IS NOT NULL GROUP BY "puzzleId", "visitorId"
) merged WHERE a.id = merged.keep_id;
DELETE FROM "PuzzleAttempt" a USING "PuzzleAttempt" b
WHERE a."puzzleId" = b."puzzleId" AND a."visitorId" = b."visitorId" AND a.id > b.id;
DROP INDEX "PuzzleAttempt_puzzleId_visitorId_idx";
CREATE UNIQUE INDEX "PuzzleAttempt_puzzleId_visitorId_key" ON "PuzzleAttempt"("puzzleId", "visitorId");
