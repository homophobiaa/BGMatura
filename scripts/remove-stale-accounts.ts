// Retention job: expired sessions and accounts inactive for two years are deleted. Run it on a schedule (daily is plenty).
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.ts";
import { removeStaleAccountData } from "../src/features/account/data-removal.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const database = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
try {
  const result = await removeStaleAccountData(database);
  console.log(`Removed ${result.expiredSessions} expired sessions and ${result.inactiveAccounts} inactive accounts.`);
} finally {
  await database.$disconnect();
}
