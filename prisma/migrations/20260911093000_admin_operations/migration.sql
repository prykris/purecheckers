ALTER TYPE "CoinReason" ADD VALUE 'ADMIN_ADJUSTMENT';
CREATE TABLE "AdminOperation" (
  "id" SERIAL NOT NULL, "actorId" INTEGER NOT NULL, "targetId" INTEGER NOT NULL,
  "key" TEXT NOT NULL, "kind" TEXT NOT NULL, "payload" JSONB NOT NULL, "receipt" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminOperation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminOperation_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AdminOperation_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AdminOperation_actorId_key_key" ON "AdminOperation"("actorId", "key");
CREATE INDEX "AdminOperation_targetId_createdAt_idx" ON "AdminOperation"("targetId", "createdAt");
