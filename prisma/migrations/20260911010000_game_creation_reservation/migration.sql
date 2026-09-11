ALTER TYPE "CoinReason" ADD VALUE 'WAGER_STAKE';
ALTER TYPE "CoinReason" ADD VALUE 'WAGER_REFUND';
CREATE TABLE "GameRun" (
  "id" SERIAL NOT NULL,
  "key" TEXT NOT NULL,
  "redPlayerId" INTEGER NOT NULL,
  "blackPlayerId" INTEGER NOT NULL,
  "mode" "GameMode" NOT NULL,
  "buyIn" INTEGER NOT NULL,
  "turnTime" INTEGER NOT NULL,
  "origin" TEXT NOT NULL,
  "initialState" JSONB NOT NULL,
  "stateVersion" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "replayId" INTEGER,
  CONSTRAINT "GameRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GameRun_buyIn_check" CHECK ("buyIn" >= 0 AND ("buyIn" = 0 OR "mode" = 'RANKED')),
  CONSTRAINT "GameRun_players_check" CHECK ("redPlayerId" <> "blackPlayerId"),
  CONSTRAINT "GameRun_status_check" CHECK ("status" IN ('OPEN', 'SETTLED', 'ABORTED'))
);
CREATE UNIQUE INDEX "GameRun_key_key" ON "GameRun"("key");
CREATE UNIQUE INDEX "GameRun_replayId_key" ON "GameRun"("replayId");
CREATE INDEX "GameRun_status_createdAt_idx" ON "GameRun"("status", "createdAt");
CREATE INDEX "GameRun_redPlayerId_idx" ON "GameRun"("redPlayerId");
CREATE INDEX "GameRun_blackPlayerId_idx" ON "GameRun"("blackPlayerId");
ALTER TABLE "GameRun" ADD CONSTRAINT "GameRun_redPlayerId_fkey" FOREIGN KEY ("redPlayerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GameRun" ADD CONSTRAINT "GameRun_blackPlayerId_fkey" FOREIGN KEY ("blackPlayerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GameRun" ADD CONSTRAINT "GameRun_replayId_fkey" FOREIGN KEY ("replayId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;
