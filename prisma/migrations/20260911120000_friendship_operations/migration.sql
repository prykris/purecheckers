-- Remove invalid self-pairs. For legacy opposite-direction duplicates retain
-- BLOCKED over ACCEPTED over PENDING, then the oldest row of that status.
-- No relationship is promoted and no reciprocal request implies acceptance.
DELETE FROM "Friendship" WHERE "requesterId" = "receiverId";
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY LEAST("requesterId", "receiverId"), GREATEST("requesterId", "receiverId")
    ORDER BY CASE status WHEN 'BLOCKED' THEN 0 WHEN 'ACCEPTED' THEN 1 ELSE 2 END, "createdAt", id
  ) AS position FROM "Friendship"
)
DELETE FROM "Friendship" WHERE id IN (SELECT id FROM ranked WHERE position > 1);
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_distinct_users" CHECK ("requesterId" <> "receiverId");
CREATE UNIQUE INDEX "Friendship_unordered_pair" ON "Friendship" (LEAST("requesterId", "receiverId"), GREATEST("requesterId", "receiverId"));

CREATE TABLE "FriendshipOperation" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "key" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "receipt" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FriendshipOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FriendshipOperation_userId_key_key" ON "FriendshipOperation" ("userId", "key");
