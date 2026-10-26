import { describe, expect, it } from "vitest";

import { assertTestDatabaseUrl } from "./database-target";

const testConnection = "postgresql://bgmatura_test:example-only@127.0.0.1:55433/bgmatura_test";

describe("integration database target protection", () => {
  it("accepts the dedicated local test target", () => {
    expect(assertTestDatabaseUrl(testConnection)).toBe(testConnection);
  });

  it.each([
    "",
    "not-a-connection",
    testConnection.replace("127.0.0.1", "database.example.com"),
    testConnection.replace("55433", "5432"),
    testConnection.replace("55433", "55432"),
    testConnection.replace("/bgmatura_test", "/bgmatura_dev"),
    testConnection.replace("bgmatura_test:", "production_user:"),
    testConnection + "?options=-csearch_path=production",
    testConnection + "#ignored-fragment",
  ])("rejects unsafe or ambiguous targets without exposing their values", (connection) => {
    expect(() => assertTestDatabaseUrl(connection)).toThrow();
  });
});
