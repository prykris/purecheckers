CREATE TYPE "RoomStatus" AS ENUM ('WAITING', 'STARTING', 'PLAYING', 'CLOSED');
CREATE TYPE "RoomMemberRole" AS ENUM ('PLAYER', 'SPECTATOR');
CREATE TABLE "RoomRecord" (
  "id" BIGSERIAL PRIMARY KEY,
  "creatorId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "creationKey" TEXT NOT NULL,
  "creation" JSONB NOT NULL,
  "joinCode" TEXT NOT NULL,
  "status" "RoomStatus" NOT NULL DEFAULT 'WAITING',
  "state" JSONB NOT NULL,
  "stateVersion" INTEGER NOT NULL DEFAULT 1,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "RoomRecord_creatorId_creationKey_key" ON "RoomRecord"("creatorId", "creationKey");
CREATE UNIQUE INDEX "RoomRecord_joinCode_key" ON "RoomRecord"("joinCode");
CREATE INDEX "RoomRecord_status_id_idx" ON "RoomRecord"("status", "id");
CREATE TABLE "ActiveRoomMember" (
  "userId" INTEGER PRIMARY KEY REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "roomId" BIGINT NOT NULL REFERENCES "RoomRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "role" "RoomMemberRole" NOT NULL
);
CREATE INDEX "ActiveRoomMember_roomId_idx" ON "ActiveRoomMember"("roomId");
CREATE TABLE "RoomCommandReceipt" (
  "id" SERIAL PRIMARY KEY,
  "roomId" BIGINT NOT NULL REFERENCES "RoomRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "userId" INTEGER NOT NULL,
  "key" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "revision" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "RoomCommandReceipt_roomId_userId_key_key" ON "RoomCommandReceipt"("roomId", "userId", "key");
ALTER TABLE "GameRun" ADD COLUMN "roomId" BIGINT;
ALTER TABLE "GameRun" ADD CONSTRAINT "GameRun_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "RoomRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "GameRun_roomId_idx" ON "GameRun"("roomId");
