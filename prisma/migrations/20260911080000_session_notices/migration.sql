CREATE TABLE "SessionNotice" (
  "id" TEXT NOT NULL,
  "sequence" BIGSERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "effectKey" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "context" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dismissedAt" TIMESTAMP(3),
  CONSTRAINT "SessionNotice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SessionNotice_sequence_key" ON "SessionNotice"("sequence");
CREATE UNIQUE INDEX "SessionNotice_userId_effectKey_key" ON "SessionNotice"("userId", "effectKey");
CREATE INDEX "SessionNotice_userId_sequence_idx" ON "SessionNotice"("userId", "sequence" DESC);
ALTER TABLE "SessionNotice" ADD CONSTRAINT "SessionNotice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
