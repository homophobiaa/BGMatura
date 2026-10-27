import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import pg from "pg";
import { z } from "zod";

export const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

const modeSchema = z.enum(["development", "test"]);
type DatabaseMode = z.infer<typeof modeSchema>;
const credentialSchema = z.strictObject({ password: z.string().regex(/^[a-f0-9]{64}$/) });

class LocalDatabaseError extends Error {}

function databasePaths(mode: DatabaseMode) {
  const directory = join(repositoryRoot, ".local", "postgres", mode);

  return {
    directory,
    data: join(directory, "data"),
    credentials: join(directory, "credentials.json"),
    port: mode === "development" ? 55432 : 55433,
    name: mode === "development" ? "bgmatura_dev" : "bgmatura_test",
  };
}

export async function getLocalDatabaseSettings(mode: DatabaseMode) {
  const paths = databasePaths(mode);
  if (!existsSync(paths.credentials)) {
    throw new LocalDatabaseError(`Start the ${mode} database first using the documented npm command.`);
  }
  const stored: unknown = JSON.parse(await readFile(paths.credentials, "utf8"));
  const credentials = credentialSchema.safeParse(stored);
  if (!credentials.success) {
    throw new LocalDatabaseError("The project-local database credential file is invalid.");
  }
  const connectionString =
    `postgresql://${paths.name}:${credentials.data.password}` +
    `@127.0.0.1:${paths.port}/${paths.name}`;

  return { ...paths, password: credentials.data.password, connectionString };
}

function postgresExecutable(command: string): string {
  const name = process.platform === "win32" ? `${command}.exe` : command;
  const portable = join(repositoryRoot, ".local", "postgresql-runtime", "pgsql", "bin");
  const binaryDirectory = process.env.PG_BIN_DIR ?? (existsSync(join(portable, name)) ? portable : undefined);
  return binaryDirectory ? join(binaryDirectory, name) : name;
}

function runPostgres(command: string, args: string[]) {
  execFileSync(postgresExecutable(command), args, { cwd: repositoryRoot, stdio: "inherit" });
}

function isRunning(data: string): boolean {
  return spawnSync(postgresExecutable("pg_ctl"), ["status", "-D", data], { stdio: "ignore" }).status === 0;
}

async function assertUnusedPort(port: number): Promise<void> {
  await new Promise<void>((accept, reject) => {
    const server = createServer();
    server.once("error", () => reject(new LocalDatabaseError(`Local port ${port} is already occupied.`)));
    server.listen(port, "127.0.0.1", () => server.close(() => accept()));
  });
}

async function start(mode: DatabaseMode): Promise<void> {
  const paths = databasePaths(mode);
  await mkdir(paths.directory, { recursive: true });
  if (!existsSync(paths.credentials)) {
    await writeFile(paths.credentials, JSON.stringify({ password: randomBytes(32).toString("hex") }), {
      flag: "wx", mode: 0o600,
    });
  }
  const settings = await getLocalDatabaseSettings(mode);

  if (!existsSync(join(paths.data, "PG_VERSION"))) {
    await assertUnusedPort(paths.port);
    const passwordFile = join(paths.directory, `init-password-${randomUUID()}.txt`);
    await writeFile(passwordFile, settings.password, { flag: "wx", mode: 0o600 });
    try {
      runPostgres("initdb", [
        "-D", paths.data, "--username", paths.name, "--encoding=UTF8", "--locale=C",
        "--auth=scram-sha-256", "--pwfile", passwordFile,
      ]);
    } finally {
      await unlink(passwordFile);
    }
  }

  if (!isRunning(paths.data)) {
    await assertUnusedPort(paths.port);
    runPostgres("pg_ctl", [
      "start", "-D", paths.data, "-l", join(paths.directory, "postgres.log"), "-w", "-t", "30",
      "-o", `-h 127.0.0.1 -p ${paths.port} -c timezone=UTC`,
    ]);
  }

  const connection = new pg.Client({
    host: "127.0.0.1", port: paths.port, user: paths.name, password: settings.password,
    database: "postgres", connectionTimeoutMillis: 5000,
  });
  try {
    await connection.connect();
    const existing = await connection.query("SELECT 1 FROM pg_database WHERE datname = $1", [paths.name]);
    if (existing.rowCount === 0) {
      // The identifier comes exclusively from databasePaths, never from user input.
      await connection.query(`CREATE DATABASE "${paths.name}"`);
    }
    await connection.query("SELECT 1");
  } finally {
    await connection.end();
  }

  await writeFile(join(paths.directory, "connection.env"), `DATABASE_URL=${settings.connectionString}\n`, {
    mode: 0o600,
  });
  const environmentPath = join(repositoryRoot, ".env.local");
  if (mode === "development" && !existsSync(environmentPath)) {
    await writeFile(environmentPath, `DATABASE_URL=${settings.connectionString}\n`, { flag: "wx", mode: 0o600 });
  }
  console.log(`Project-local ${mode} PostgreSQL ready on 127.0.0.1:${paths.port}. Credentials are ignored by Git.`);
}

function stop(mode: DatabaseMode): void {
  const paths = databasePaths(mode);
  if (isRunning(paths.data)) {
    runPostgres("pg_ctl", ["stop", "-D", paths.data, "-m", "fast", "-w"]);
  }
  console.log(`Project-local ${mode} PostgreSQL stopped. Its data is retained.`);
}

async function resetDevelopment(): Promise<void> {
  const settings = await getLocalDatabaseSettings("development");
  if (!isRunning(settings.data)) {
    throw new LocalDatabaseError("Start the project-local development cluster before resetting it.");
  }
  // This command never loads DATABASE_URL from the user's shell or .env files.
  execFileSync(process.execPath, [
    join(repositoryRoot, "node_modules/prisma/build/index.js"), "migrate", "reset", "--force",
    "--config", "prisma7.config.ts",
  ], { cwd: repositoryRoot, stdio: "inherit", env: { ...process.env, DATABASE_URL: settings.connectionString } });
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const mode = modeSchema.parse(process.argv[3] ?? "development");
  if (command === "start") return start(mode);
  if (command === "stop") return stop(mode);
  if (command === "reset" && mode === "development") return resetDevelopment();
  throw new LocalDatabaseError("Use start/stop with development/test, or reset with development only.");
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(error instanceof LocalDatabaseError ? error.message :
      "Local database command failed. Check PostgreSQL 18 binaries on PATH, the selected local port, and project-local logs. Connection secrets are not printed.");
    process.exitCode = 1;
  });
}
