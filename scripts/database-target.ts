/** Tests must never use DATABASE_URL or accept a remote/production target. */
export function assertTestDatabaseUrl(value: string): string {
  if (!URL.canParse(value)) {
    throw new Error("A dedicated local TEST_DATABASE_URL is required.");
  }

  const target = new URL(value);
  const isTestTarget =
    ["postgresql:", "postgres:"].includes(target.protocol) &&
    ["127.0.0.1", "localhost"].includes(target.hostname) &&
    target.port === "55433" &&
    target.username === "bgmatura_test" &&
    target.pathname === "/bgmatura_test" &&
    target.search === "" &&
    target.hash === "";

  if (!isTestTarget) {
    throw new Error(
      "Tests require bgmatura_test as user and database on loopback port 55433, without URL options.",
    );
  }

  return value;
}
