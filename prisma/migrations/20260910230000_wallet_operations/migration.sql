CREATE TABLE "WalletOperation" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receipt" JSONB NOT NULL,
    "burned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletOperation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WalletOperation_burned_check" CHECK ("burned" >= 0)
);
CREATE UNIQUE INDEX "WalletOperation_userId_key_key" ON "WalletOperation"("userId", "key");
ALTER TABLE "WalletOperation" ADD CONSTRAINT "WalletOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
