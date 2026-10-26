import { afterAll, beforeAll, vi } from "vitest";

import { assertTestDatabaseUrl } from "../../scripts/database-target";

// Node integration tests exercise real Prisma services; only the React import
// condition marker is mocked. Application builds retain the real guard.
vi.mock("server-only", () => ({}));

import { getDatabase } from "@/server/database";

beforeAll(async () => {
  assertTestDatabaseUrl(process.env.DATABASE_URL ?? "");
  await getDatabase().$queryRaw`SELECT 1`;
});

afterAll(async () => {
  await getDatabase().$disconnect();
});
