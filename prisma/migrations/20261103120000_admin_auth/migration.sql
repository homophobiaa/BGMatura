BEGIN;
CREATE TABLE "AdminUser" (
  "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "email" TEXT NOT NULL,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false, "image" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");
CREATE TABLE "AdminSession" (
  "id" TEXT PRIMARY KEY, "token" TEXT NOT NULL, "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "ipAddress" TEXT, "userAgent" TEXT, "userId" TEXT NOT NULL REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AdminSession_token_key" ON "AdminSession"("token");
CREATE INDEX "AdminSession_userId_idx" ON "AdminSession"("userId");
CREATE TABLE "AdminAccount" (
  "id" TEXT PRIMARY KEY, "accountId" TEXT NOT NULL, "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "accessToken" TEXT, "refreshToken" TEXT, "idToken" TEXT, "scope" TEXT, "password" TEXT,
  "accessTokenExpiresAt" TIMESTAMPTZ(3), "refreshTokenExpiresAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE UNIQUE INDEX "AdminAccount_providerId_accountId_key" ON "AdminAccount"("providerId", "accountId");
CREATE INDEX "AdminAccount_userId_idx" ON "AdminAccount"("userId");
CREATE TABLE "AdminVerification" (
  "id" TEXT PRIMARY KEY, "identifier" TEXT NOT NULL, "value" TEXT NOT NULL, "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "AdminVerification_identifier_idx" ON "AdminVerification"("identifier");
COMMIT;
