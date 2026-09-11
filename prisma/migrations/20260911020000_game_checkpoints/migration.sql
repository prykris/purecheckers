ALTER TABLE "GameRun" ADD COLUMN "checkpoint" JSONB, ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "GameCommandReceipt" (
  "id" SERIAL NOT NULL,
  "gameRunId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "key" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "revision" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GameCommandReceipt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GameCommandReceipt_gameRunId_userId_key_key" ON "GameCommandReceipt"("gameRunId", "userId", "key");
ALTER TABLE "GameCommandReceipt" ADD CONSTRAINT "GameCommandReceipt_gameRunId_fkey" FOREIGN KEY ("gameRunId") REFERENCES "GameRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
