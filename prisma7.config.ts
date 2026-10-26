import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Client generation is allowed without credentials. Database commands still
  // require an explicitly configured URL; there is no production fallback.
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
