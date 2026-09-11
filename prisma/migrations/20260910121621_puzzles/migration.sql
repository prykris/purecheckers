-- CreateEnum
CREATE TYPE "PuzzleDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- AlterEnum
ALTER TYPE "CoinReason" ADD VALUE 'PUZZLE_SOLVE';

-- CreateTable
CREATE TABLE "Puzzle" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "positionHash" TEXT NOT NULL,
    "position" JSONB NOT NULL,
    "solution" JSONB NOT NULL,
    "sideToMove" TEXT NOT NULL,
    "difficulty" "PuzzleDifficulty" NOT NULL,
    "theme" TEXT NOT NULL,
    "themes" TEXT[],
    "solutionPlies" INTEGER NOT NULL,
    "legalMoves" INTEGER NOT NULL,
    "scoreGap" DOUBLE PRECISION NOT NULL,
    "verifiedDepth" INTEGER NOT NULL,
    "commentary" JSONB,
    "sourceGameId" INTEGER,
    "generatorVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Puzzle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PuzzleAttempt" (
    "id" SERIAL NOT NULL,
    "puzzleId" INTEGER NOT NULL,
    "userId" INTEGER,
    "visitorId" TEXT,
    "solved" BOOLEAN NOT NULL,
    "attempts" INTEGER NOT NULL,
    "hintUsed" BOOLEAN NOT NULL DEFAULT false,
    "timeMs" INTEGER,
    "rewarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PuzzleAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Puzzle_date_key" ON "Puzzle"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Puzzle_positionHash_key" ON "Puzzle"("positionHash");

-- CreateIndex
CREATE INDEX "PuzzleAttempt_puzzleId_visitorId_idx" ON "PuzzleAttempt"("puzzleId", "visitorId");

-- CreateIndex
CREATE UNIQUE INDEX "PuzzleAttempt_puzzleId_userId_key" ON "PuzzleAttempt"("puzzleId", "userId");

-- AddForeignKey
ALTER TABLE "PuzzleAttempt" ADD CONSTRAINT "PuzzleAttempt_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "Puzzle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleAttempt" ADD CONSTRAINT "PuzzleAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
