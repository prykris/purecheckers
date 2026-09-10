-- Stable bot identity; existing users remain unchanged until safely provisioned.
ALTER TABLE "User" ADD COLUMN "botKey" TEXT;
CREATE UNIQUE INDEX "User_botKey_key" ON "User"("botKey");
