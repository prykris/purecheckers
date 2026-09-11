CREATE TABLE "GameSettlementJob" (
    "key" TEXT NOT NULL,
    "intent" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "replayId" INTEGER,
    CONSTRAINT "GameSettlementJob_pkey" PRIMARY KEY ("key")
);
CREATE UNIQUE INDEX "GameSettlementJob_replayId_key" ON "GameSettlementJob"("replayId");
CREATE INDEX "GameSettlementJob_completedAt_nextAttemptAt_createdAt_idx" ON "GameSettlementJob"("completedAt", "nextAttemptAt", "createdAt");
ALTER TABLE "GameSettlementJob" ADD CONSTRAINT "GameSettlementJob_replayId_fkey" FOREIGN KEY ("replayId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
