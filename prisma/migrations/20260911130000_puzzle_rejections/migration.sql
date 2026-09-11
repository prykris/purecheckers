CREATE TABLE "PuzzleRejection" (
    "positionHash" TEXT NOT NULL,
    "oppositeHash" TEXT NOT NULL,
    "sourceDate" DATE NOT NULL,
    "verifiedDepth" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "generatorVersion" TEXT NOT NULL,
    "verifierVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PuzzleRejection_pkey" PRIMARY KEY ("positionHash")
);
