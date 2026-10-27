import "server-only";

import { z } from "zod";

function isPostgreSqlConnection(value: string): boolean {
  if (!URL.canParse(value)) {
    return false;
  }

  const connection = new URL(value);

  return (
    (connection.protocol === "postgresql:" || connection.protocol === "postgres:") &&
    connection.hostname.length > 0 &&
    connection.pathname.length > 1
  );
}

const serverEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).refine(isPostgreSqlConnection),
});

export type ServerEnvironment = Readonly<z.infer<typeof serverEnvironmentSchema>>;

/** Read at a server feature boundary, not during unrelated static page builds. */
export function getServerEnvironment(
  environment: Record<string, string | undefined> = process.env,
): ServerEnvironment {
  const result = serverEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    const invalidNames = [...new Set(result.error.issues.map((issue) => issue.path[0]))];

    // Zod errors and raw input can contain credentials; report only known field names.
    throw new Error(
      `Invalid server configuration: ${invalidNames.join(", ")}. ` +
        "Check .env.local or the hosting environment. DATABASE_URL must be a PostgreSQL URL with a host and database name.",
    );
  }

  return result.data;
}
