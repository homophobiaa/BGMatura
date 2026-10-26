import { afterEach, describe, expect, it, vi } from "vitest";

// Only this Node test bypasses the React server-condition marker. Next.js still
// enforces the real marker when it compiles application imports.
vi.mock("server-only", () => ({}));

import { getServerEnvironment } from "./environment";

const exampleConnection = "postgresql://example:example@localhost:5432/bgmatura_test";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("server environment", () => {
  it.each(["postgresql", "postgres"])("accepts a %s connection", (protocol) => {
    const databaseUrl = `${protocol}://example:example@localhost:5432/bgmatura_test`;

    expect(getServerEnvironment({ NODE_ENV: "test", DATABASE_URL: databaseUrl })).toEqual({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
    });
  });

  it("defaults the mode and excludes undeclared environment values", () => {
    expect(
      getServerEnvironment({
        DATABASE_URL: exampleConnection,
        UNRELATED_SECRET: "not-part-of-the-return-value",
        NEXT_PUBLIC_DATABASE_URL: "must-not-be-returned",
      }),
    ).toEqual({ NODE_ENV: "development", DATABASE_URL: exampleConnection });
  });

  it.each([
    "",
    "not-a-url",
    "https://example.com/bgmatura",
    "mysql://localhost/bgmatura",
    "postgresql:///bgmatura",
    "postgresql://localhost",
  ])("rejects an unusable database connection: %s", (databaseUrl) => {
    expect(() => getServerEnvironment({ DATABASE_URL: databaseUrl })).toThrow(
      "Invalid server configuration: DATABASE_URL",
    );
  });

  it("reports missing and invalid fields without revealing credentials", () => {
    const privateValue = "https://example:do-not-log-this-password@example.com/bgmatura";

    try {
      getServerEnvironment({ NODE_ENV: "invalid-mode", DATABASE_URL: privateValue });
      expect.fail("Invalid configuration must be rejected");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      if (!(error instanceof Error)) {
        throw error;
      }
      expect(error.message).toContain("NODE_ENV");
      expect(error.message).toContain("DATABASE_URL");
      expect(error.message).not.toContain(privateValue);
      expect(error.message).not.toContain("do-not-log-this-password");
    }
  });

  it("rejects a missing database connection", () => {
    expect(() => getServerEnvironment({})).toThrow("DATABASE_URL");
  });

  it("reads the actual process environment only when called", () => {
    vi.stubEnv("DATABASE_URL", exampleConnection);
    vi.stubEnv("NODE_ENV", "test");

    expect(getServerEnvironment()).toEqual({ NODE_ENV: "test", DATABASE_URL: exampleConnection });
  });
});
