BEGIN;

-- The auth tables now serve administrators and, optionally, students, so their names no longer say Admin.
-- Renaming keeps every existing row, session, and foreign key working. Nothing is dropped or recreated.
ALTER TABLE "AdminUser" RENAME TO "AuthUser";
ALTER TABLE "AdminSession" RENAME TO "AuthSession";
ALTER TABLE "AdminAccount" RENAME TO "AuthAccount";
ALTER TABLE "AdminVerification" RENAME TO "AuthVerification";

-- Constraints and indexes keep the names Prisma derives from the new table names, so the schema and the database stay in sync.
ALTER TABLE "AuthUser" RENAME CONSTRAINT "AdminUser_pkey" TO "AuthUser_pkey";
ALTER INDEX "AdminUser_email_key" RENAME TO "AuthUser_email_key";

ALTER TABLE "AuthSession" RENAME CONSTRAINT "AdminSession_pkey" TO "AuthSession_pkey";
ALTER TABLE "AuthSession" RENAME CONSTRAINT "AdminSession_userId_fkey" TO "AuthSession_userId_fkey";
ALTER INDEX "AdminSession_token_key" RENAME TO "AuthSession_token_key";
ALTER INDEX "AdminSession_userId_idx" RENAME TO "AuthSession_userId_idx";

ALTER TABLE "AuthAccount" RENAME CONSTRAINT "AdminAccount_pkey" TO "AuthAccount_pkey";
ALTER TABLE "AuthAccount" RENAME CONSTRAINT "AdminAccount_userId_fkey" TO "AuthAccount_userId_fkey";
ALTER INDEX "AdminAccount_providerId_accountId_key" RENAME TO "AuthAccount_providerId_accountId_key";
ALTER INDEX "AdminAccount_userId_idx" RENAME TO "AuthAccount_userId_idx";

ALTER TABLE "AuthVerification" RENAME CONSTRAINT "AdminVerification_pkey" TO "AuthVerification_pkey";
ALTER INDEX "AdminVerification_identifier_idx" RENAME TO "AuthVerification_identifier_idx";

COMMIT;
