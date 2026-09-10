-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "isGuest" BOOLEAN NOT NULL DEFAULT false,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
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
INSERT INTO "new_User" ("coins", "createdAt", "elo", "email", "friendCode", "gamesPlayed", "guestExpiresAt", "id", "isBot", "isGuest", "lastDailyWin", "losses", "passwordHash", "peakElo", "updatedAt", "username", "wins") SELECT "coins", "createdAt", "elo", "email", "friendCode", "gamesPlayed", "guestExpiresAt", "id", "isBot", "isGuest", "lastDailyWin", "losses", "passwordHash", "peakElo", "updatedAt", "username", "wins" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_friendCode_key" ON "User"("friendCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
