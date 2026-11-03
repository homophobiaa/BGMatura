import { describe, expect, it } from "vitest";

import { isSafeContentLink, learningContentSchema } from "./content";

describe("learning content format", () => {
  it("accepts an empty draft and the supported structured blocks", () => {
    expect(learningContentSchema.parse({ version: 1, blocks: [] }).blocks).toEqual([]);
    const content = { version: 1, blocks: [
      { type: "heading", level: 2, text: "Демонстрация — непроверено съдържание" },
      { type: "paragraph", content: [{ type: "text", text: "Текст с „кавички“ и ѝ." }] },
      { type: "list", ordered: true, items: [[{ type: "text", text: "Първа точка" }]] },
      { type: "example", title: "Пример", content: [{ type: "link", text: "Начало", href: "/" }] },
      { type: "quotation", content: [{ type: "text", text: "Демонстрационен цитат" }], attribution: "Тестов източник" },
    ] };
    expect(learningContentSchema.parse(content)).toEqual(content);
  });

  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "//evil.test", "/\\evil.test", "https://user:password@example.com", " https://example.com", "https://example.com/\npath", "mailto:test@example.com"])("rejects unsafe link %s", (href) => {
    expect(isSafeContentLink(href)).toBe(false);
    expect(learningContentSchema.safeParse({ version: 1, blocks: [
      { type: "paragraph", content: [{ type: "link", text: "Връзка", href }] },
    ] }).success).toBe(false);
  });

  it.each(["/balgarski-ezik/pravopis", "/?topic=test#example", "https://example.com/path", "http://localhost:3000/"])("accepts web/path link %s", (href) => {
    expect(isSafeContentLink(href)).toBe(true);
  });

  it.each([
    { version: 2, blocks: [] },
    { version: 1, blocks: [{ type: "html", html: "<script>alert(1)</script>" }] },
    { version: 1, blocks: [{ type: "heading", level: 1, text: "Title" }] },
    { version: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text: "  " }] }] },
    { version: 1, blocks: [{ type: "heading", level: 2, text: "Title", onclick: "alert(1)" }] },
  ])("rejects unsupported versions, blocks, levels, blank text, and unknown fields", (content) => {
    expect(learningContentSchema.safeParse(content).success).toBe(false);
  });

  it("preserves HTML-looking text as literal text, never an HTML node", () => {
    const content = { version: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text: "<img src=x onerror=alert(1)>" }] }] };
    expect(learningContentSchema.parse(content)).toEqual(content);
  });
});
