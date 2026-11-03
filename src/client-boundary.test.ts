import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Answer keys must never reach the browser, and hiding them in the UI is not enough. The
 * build already stops a Client Component from importing a module that imports "server-only".
 * This test is the second line of defence: no Client Component may import server code,
 * the database client, Node built-ins, or the generated Prisma client, directly.
 */

const sourceRoot = fileURLToPath(new URL(".", import.meta.url));

const USE_CLIENT_DIRECTIVE = /^\s*(?:(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)\s*)*["']use client["']/;
const IMPORT_SPECIFIER =
  /(?:import|export)\s[^"'`;]*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

export function isClientComponent(source: string): boolean {
  return USE_CLIENT_DIRECTIVE.test(source);
}

export function importSpecifiers(source: string): string[] {
  return [...source.matchAll(IMPORT_SPECIFIER)].map((match) => match[1] ?? match[2] ?? match[3] ?? "");
}

export function isServerOnlySpecifier(specifier: string): boolean {
  return (
    specifier === "server-only" ||
    specifier === "pg" ||
    specifier.startsWith("node:") ||
    specifier.startsWith("@prisma/") ||
    specifier.includes("generated/prisma") ||
    /(^|\/)server(\/|$)/.test(specifier)
  );
}

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return entry.name === "generated" ? [] : listSourceFiles(path);
    }

    return /\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("Client Component boundary", () => {
  it("lets no Client Component import server-only code", () => {
    const violations = listSourceFiles(sourceRoot).flatMap((file) => {
      const source = readFileSync(file, "utf8");

      if (!isClientComponent(source)) {
        return [];
      }

      return importSpecifiers(source)
        .filter(isServerOnlySpecifier)
        .map((specifier) => `${relative(sourceRoot, file).split(sep).join("/")} imports ${specifier}`);
    });

    expect(violations).toEqual([]);
  });

  describe("detection", () => {
    it("recognizes the use client directive, including after comments", () => {
      expect(isClientComponent('"use client";\nimport x from "y";')).toBe(true);
      expect(isClientComponent("'use client'\n")).toBe(true);
      expect(isClientComponent('// Interactive form\n/* more */\n"use client";')).toBe(true);
      expect(isClientComponent('import x from "y";\n"use client";')).toBe(false);
      expect(isClientComponent("export const a = 1;")).toBe(false);
    });

    it("finds static, side-effect, re-export, and dynamic imports", () => {
      const source = [
        'import { a } from "@/server/database";',
        'import type { B } from "../server/contracts";',
        'import "server-only";',
        'export { c } from "node:fs";',
        'const d = await import("@/generated/prisma/client");',
        'import { ok } from "./local";',
      ].join("\n");

      expect(importSpecifiers(source)).toEqual([
        "@/server/database",
        "../server/contracts",
        "server-only",
        "node:fs",
        "@/generated/prisma/client",
        "./local",
      ]);
    });

    it.each([
      "server-only",
      "@/server/database",
      "../server/contracts",
      "@/features/questions/server/public-questions",
      "@/generated/prisma/client",
      "@prisma/client",
      "node:crypto",
      "pg",
    ])("flags %s as server-only", (specifier) => {
      expect(isServerOnlySpecifier(specifier)).toBe(true);
    });

    it.each(["react", "next/link", "@/features/questions/types", "./Button", "../components/servers-list"])(
      "allows %s",
      (specifier) => {
        expect(isServerOnlySpecifier(specifier)).toBe(false);
      },
    );
  });
});
