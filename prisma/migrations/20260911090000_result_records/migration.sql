CREATE TYPE "ResultStatus" AS ENUM ('OPEN', 'STARTING', 'REMATCHED', 'CLOSED');
CREATE TABLE "GameResultRecord" (
  "gameRunId" INTEGER NOT NULL,
  "status" "ResultStatus" NOT NULL,
  "state" JSONB NOT NULL,
  "stateVersion" INTEGER NOT NULL DEFAULT 1,
  "revision" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "GameResultRecord_pkey" PRIMARY KEY ("gameRunId")
);
CREATE INDEX "GameResultRecord_status_gameRunId_idx" ON "GameResultRecord"("status", "gameRunId");
ALTER TABLE "GameResultRecord" ADD CONSTRAINT "GameResultRecord_gameRunId_fkey" FOREIGN KEY ("gameRunId") REFERENCES "GameRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "ActiveResultViewer" (
  "userId" INTEGER NOT NULL,
  "gameRunId" INTEGER NOT NULL,
  "role" "RoomMemberRole" NOT NULL,
  CONSTRAINT "ActiveResultViewer_pkey" PRIMARY KEY ("userId")
);
CREATE INDEX "ActiveResultViewer_gameRunId_idx" ON "ActiveResultViewer"("gameRunId");
ALTER TABLE "ActiveResultViewer" ADD CONSTRAINT "ActiveResultViewer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActiveResultViewer" ADD CONSTRAINT "ActiveResultViewer_gameRunId_fkey" FOREIGN KEY ("gameRunId") REFERENCES "GameResultRecord"("gameRunId") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "GameResultCommandReceipt" (
  "id" SERIAL NOT NULL,
  "gameRunId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "key" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "revision" INTEGER NOT NULL,
  CONSTRAINT "GameResultCommandReceipt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GameResultCommandReceipt_gameRunId_userId_key_key" ON "GameResultCommandReceipt"("gameRunId", "userId", "key");
ALTER TABLE "GameResultCommandReceipt" ADD CONSTRAINT "GameResultCommandReceipt_gameRunId_fkey" FOREIGN KEY ("gameRunId") REFERENCES "GameResultRecord"("gameRunId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameRun" ADD COLUMN "resultSourceId" INTEGER;
CREATE INDEX "GameRun_resultSourceId_idx" ON "GameRun"("resultSourceId");
ALTER TABLE "GameRun" ADD CONSTRAINT "GameRun_resultSourceId_fkey" FOREIGN KEY ("resultSourceId") REFERENCES "GameResultRecord"("gameRunId") ON DELETE SET NULL ON UPDATE CASCADE;
