ALTER TABLE "ChatMessage" ADD COLUMN "clientMessageId" TEXT,
  ADD COLUMN "mentions" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "spectator" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "ChatMessage_senderId_clientMessageId_key" ON "ChatMessage"("senderId", "clientMessageId");
CREATE INDEX "ChatMessage_channelId_id_idx" ON "ChatMessage"("channelId", "id");
CREATE INDEX "ChatMessage_senderId_channelId_id_idx" ON "ChatMessage"("senderId", "channelId", "id");
-- Preserve the previous angle-bracket encoding and normalize literal ampersands.
-- Current clients receive decoded plain text on the versioned chat protocol.
UPDATE "ChatMessage" SET "content" = regexp_replace("content", '&(?!lt;|gt;)', '&amp;', 'g');
