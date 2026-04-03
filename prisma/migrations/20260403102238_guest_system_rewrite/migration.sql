/*
  Warnings:

  - You are about to drop the column `gameId` on the `ChatMessage` table. All the data in the column will be lost.
  - You are about to drop the column `receiverId` on the `ChatMessage` table. All the data in the column will be lost.
  - Added the required column `channelId` to the `ChatMessage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `username` to the `ChatMessage` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "SystemVault" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "balance" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "PendingPayout" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PendingPayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VaultLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "amount" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChatMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "channelId" TEXT NOT NULL,
    "senderId" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ChatMessage" ("content", "createdAt", "id", "senderId") SELECT "content", "createdAt", "id", "senderId" FROM "ChatMessage";
DROP TABLE "ChatMessage";
ALTER TABLE "new_ChatMessage" RENAME TO "ChatMessage";
CREATE INDEX "ChatMessage_channelId_createdAt_idx" ON "ChatMessage"("channelId", "createdAt");
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "isGuest" BOOLEAN NOT NULL DEFAULT false,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "guestExpiresAt" DATETIME,
    "elo" INTEGER NOT NULL DEFAULT 1000,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "friendCode" TEXT NOT NULL,
    "lastDailyWin" DATETIME,
    "peakElo" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("coins", "createdAt", "elo", "email", "friendCode", "gamesPlayed", "id", "losses", "passwordHash", "updatedAt", "username", "wins") SELECT "coins", "createdAt", "elo", "email", "friendCode", "gamesPlayed", "id", "losses", "passwordHash", "updatedAt", "username", "wins" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_friendCode_key" ON "User"("friendCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
