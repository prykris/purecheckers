ALTER TABLE "GameSettlementJob" ADD COLUMN "redUserId" INTEGER, ADD COLUMN "blackUserId" INTEGER;
UPDATE "GameSettlementJob" SET "redUserId" = ("intent"->>'redUserId')::INTEGER, "blackUserId" = ("intent"->>'blackUserId')::INTEGER;
ALTER TABLE "GameSettlementJob" ALTER COLUMN "redUserId" SET NOT NULL, ALTER COLUMN "blackUserId" SET NOT NULL;
ALTER TABLE "GameSettlementJob" ADD CONSTRAINT "GameSettlementJob_redUserId_fkey" FOREIGN KEY ("redUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GameSettlementJob" ADD CONSTRAINT "GameSettlementJob_blackUserId_fkey" FOREIGN KEY ("blackUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
