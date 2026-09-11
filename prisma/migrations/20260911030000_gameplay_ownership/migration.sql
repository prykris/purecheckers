CREATE TABLE "GameplayOwner" (
  "id" INTEGER NOT NULL,
  "generation" INTEGER NOT NULL,
  "instanceId" TEXT NOT NULL,
  CONSTRAINT "GameplayOwner_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GameplayOwner_singleton_check" CHECK ("id" = 1),
  CONSTRAINT "GameplayOwner_generation_check" CHECK ("generation" > 0)
);
