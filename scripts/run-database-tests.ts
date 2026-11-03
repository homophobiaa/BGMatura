import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { assertTestDatabaseUrl } from "./database-target.ts";
import { getLocalDatabaseSettings, repositoryRoot } from "./local-database.ts";

async function run(): Promise<void> {
  const mode = process.argv[2];
  if (mode !== "integration" && mode !== "browser") {
    throw new Error("Choose integration or browser tests.");
  }
  const candidate = process.env.TEST_DATABASE_URL ?? (await getLocalDatabaseSettings("test")).connectionString;
  const databaseUrl = assertTestDatabaseUrl(candidate);
  const environment: NodeJS.ProcessEnv = {
    ...process.env, NODE_ENV: "test", DATABASE_URL: databaseUrl,
    ...(mode === "browser" ? { SITE_URL: "http://127.0.0.1:3102" } : {}),
  };

  execFileSync(process.execPath, [
    join(repositoryRoot, "node_modules/prisma/build/index.js"), "migrate", "deploy", "--config", "prisma7.config.ts",
  ], { cwd: repositoryRoot, env: environment, stdio: "inherit" });

  if (mode === "browser") {
    // Exercise the same compiled assets users receive, without dev compilation races.
    execFileSync(process.execPath, [join(repositoryRoot, "node_modules/next/dist/bin/next"), "build"], {
      cwd: repositoryRoot, env: { ...environment, NODE_ENV: "production" }, stdio: "inherit",
    });
  }

  const command = mode === "integration"
    ? [join(repositoryRoot, "node_modules/vitest/vitest.mjs"), "run", "--config", "vitest.integration.config.ts"]
    : [join(repositoryRoot, "node_modules/@playwright/test/cli.js"), "test"];

  execFileSync(process.execPath, command, { cwd: repositoryRoot, env: environment, stdio: "inherit" });
}

run().catch(() => {
  console.error("Database tests failed. Use the isolated local test cluster; production DATABASE_URL is never a fallback.");
  process.exitCode = 1;
});
