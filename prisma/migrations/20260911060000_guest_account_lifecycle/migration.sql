ALTER TABLE "User" ADD COLUMN "guestRetiredAt" TIMESTAMP(3);
CREATE INDEX "User_isGuest_guestRetiredAt_id_idx" ON "User"("isGuest", "guestRetiredAt", "id");
-- Recognize the previous cleanup's explicit tombstones. Ordinary new guests
-- always have an expiry; a null expiry alone does not prove retirement.
UPDATE "User" SET "guestRetiredAt" = CURRENT_TIMESTAMP
WHERE "isGuest" AND "guestExpiresAt" IS NULL
  AND "username" = '[Expired Guest ' || "id"::text || ']';
ALTER TYPE "CoinReason" ADD VALUE 'STARTER_GRANT';
