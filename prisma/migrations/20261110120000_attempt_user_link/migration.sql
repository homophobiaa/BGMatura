-- Optional link from an attempt to a signed-in student. Anonymous attempts keep a null user and their token.
ALTER TABLE "Attempt" ADD COLUMN "userId" TEXT;

CREATE INDEX "Attempt_userId_startedAt_idx" ON "Attempt"("userId", "startedAt");

ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AuthUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
