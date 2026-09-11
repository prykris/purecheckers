CREATE TABLE "ActiveGamePlayer" (
  "userId" INTEGER NOT NULL,
  "gameRunId" INTEGER NOT NULL,
  CONSTRAINT "ActiveGamePlayer_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "ActiveGamePlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ActiveGamePlayer_gameRunId_fkey" FOREIGN KEY ("gameRunId") REFERENCES "GameRun"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ActiveGamePlayer_gameRunId_idx" ON "ActiveGamePlayer"("gameRunId");
-- Bootstrap rebuilds claims from validated unfinished checkpoints after acquiring
-- writer ownership, before listening. Historical ambiguity is not resolved by SQL.
