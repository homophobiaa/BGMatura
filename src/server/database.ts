import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

import { getServerEnvironment } from "./environment";

declare global {
  var bgMaturaDatabase: PrismaClient | undefined;
}

const CONNECTION_TIMEOUT_MS = 5000;
const MAX_POOL_CONNECTIONS = 5;
let database: PrismaClient | undefined;

export function getDatabase(): PrismaClient {
  if (database) return database;
  const environment = getServerEnvironment();
  const cached = environment.NODE_ENV === "development" ? globalThis.bgMaturaDatabase : undefined;

  database = cached ?? new PrismaClient({
    adapter: new PrismaPg({
      connectionString: environment.DATABASE_URL,
      connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
      max: MAX_POOL_CONNECTIONS,
    }),
  });
  if (environment.NODE_ENV === "development") {
    globalThis.bgMaturaDatabase = database;
  }
  return database;
}
