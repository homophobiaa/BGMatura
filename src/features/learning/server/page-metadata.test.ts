import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { getSiteOrigin, learningPageMetadata, missingLearningMetadata, studyDescription } from "./page-metadata";

afterEach(() => vi.unstubAllEnvs());

it("uses only an explicit configured origin for canonical URLs", () => {
  vi.stubEnv("SITE_URL", "https://example.test");
  expect(learningPageMetadata("Литература", "Описание", "/literatura")).toEqual({
    title: "Литература — BG Matura", description: "Описание", alternates: { canonical: "https://example.test/literatura" },
  });
  vi.stubEnv("SITE_URL", "");
  expect(learningPageMetadata("Литература", "Описание", "/literatura")).not.toHaveProperty("alternates");
});

it.each(["javascript:alert(1)", "https://user:secret@example.test", "https://example.test/path", "https://example.test/?query=secret", "https://example.test/#hash"])("rejects malformed origin without exposing values", (SITE_URL) => {
  expect(() => getSiteOrigin({ SITE_URL })).toThrow(/SITE_URL/);
  try { getSiteOrigin({ SITE_URL }); } catch (error) { expect(String(error)).not.toContain(SITE_URL); }
});

it("uses honest unavailable metadata and bounded descriptions", () => {
  expect(missingLearningMetadata()).toMatchObject({ robots: { index: false, follow: false } });
  expect(missingLearningMetadata()).not.toHaveProperty("alternates");
  expect(studyDescription("  Текст\n за автора.  ", "Резервен текст")).toBe("Текст за автора.");
  expect(studyDescription("x".repeat(200), "Резервен текст")).toHaveLength(160);
  expect(studyDescription(null, "Резервен текст")).toBe("Резервен текст");
});
