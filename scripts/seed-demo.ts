import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.ts";
import { seedDemoContent } from "../prisma/demo-content.ts";
import { getLocalDatabaseSettings } from "./local-database.ts";

/**
 * Seeds demo records into the project-local development database only. It never reads
 * DATABASE_URL, so it cannot reach a hosted or production database by mistake.
 *
 * Usage: npm run db:seed:demo            (drafts, visible to editors)
 *        npm run db:seed:demo -- --publish (also published for public pages and practice)
 */
async function run(): Promise<void> {
  const unknownArguments = process.argv.slice(2).filter((argument) => argument !== "--publish");
  if (unknownArguments.length > 0) throw new Error(`Unknown option: ${unknownArguments.join(" ")}. Only --publish is supported.`);

  const { connectionString } = await getLocalDatabaseSettings("development");
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const result = await seedDemoContent(database, { publish: process.argv.includes("--publish") });
    console.log(`Demo content: ${result.created} created, ${result.skipped} already present.`);
  } finally {
    await database.$disconnect();
  }
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Demo seed failed.");
  process.exitCode = 1;
});
