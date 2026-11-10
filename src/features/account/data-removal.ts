import type { PrismaClient } from "../../generated/prisma/client.ts";
import { inactiveAccountMonths } from "./retention.ts";

// No framework imports here, so the retention script can run this under plain Node. The app uses it through
// `server/account-data.ts`, which supplies the shared database client.

/**
 * Deletes a student's account and everything attached to it, in one transaction: the attempts linked to the account
 * (their answers go with them), then the account, whose sessions and Google link are removed with it. Attempts that were
 * never linked belong to their browser token and are not touched.
 */
export async function deleteAccountAndData(userId: string, database: PrismaClient) {
  return database.$transaction(async (transaction) => {
    const attempts = await transaction.attempt.deleteMany({ where: { userId } });
    const removed = await transaction.user.deleteMany({ where: { id: userId } });
    return { attempts: attempts.count, accounts: removed.count };
  });
}

/**
 * Retention: removes expired sessions and accounts with no session activity for `inactiveAccountMonths`, together with
 * their linked attempts. Run on a schedule (see documentation/FEATURES/student-privacy.md).
 */
export async function removeStaleAccountData(database: PrismaClient, now: Date = new Date()) {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - inactiveAccountMonths);
  const sessions = await database.session.deleteMany({ where: { expiresAt: { lt: now } } });

  const stale = await database.user.findMany({
    where: { createdAt: { lt: cutoff }, sessions: { none: { updatedAt: { gte: cutoff } } } },
    select: { id: true },
  });
  let accounts = 0;
  for (const { id } of stale) accounts += (await deleteAccountAndData(id, database)).accounts;
  return { expiredSessions: sessions.count, inactiveAccounts: accounts };
}
