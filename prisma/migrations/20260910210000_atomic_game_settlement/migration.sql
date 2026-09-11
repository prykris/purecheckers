ALTER TABLE "Game" ADD COLUMN "settlementKey" TEXT, ADD COLUMN "settlement" JSONB;
CREATE UNIQUE INDEX "Game_settlementKey_key" ON "Game"("settlementKey");

-- Previous concurrent first access could create multiple vault rows. Preserve
-- their total while establishing one identity for all subsequent operations.
INSERT INTO "SystemVault" ("id", "balance")
SELECT 1, COALESCE(SUM("balance"), 0) FROM "SystemVault"
ON CONFLICT ("id") DO UPDATE SET "balance" = EXCLUDED."balance";
DELETE FROM "SystemVault" WHERE "id" <> 1;
ALTER TABLE "SystemVault" ADD CONSTRAINT "SystemVault_singleton" CHECK ("id" = 1);
