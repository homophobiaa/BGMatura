import { describe, expect, it } from "vitest";
import { inlinesToText, textToInlines } from "./inline-text";

describe("lesson inline text", () => {
  it("keeps plain text as one text part", () => {
    expect(textToInlines("Подлогът е главна част.")).toEqual([{ type: "text", text: "Подлогът е главна част." }]);
  });

  it("reads [text](address) as a link", () => {
    expect(textToInlines("Виж [урока](/balgarski-ezik/podlog) отново.")).toEqual([
      { type: "text", text: "Виж " },
      { type: "link", text: "урока", href: "/balgarski-ezik/podlog" },
      { type: "text", text: " отново." },
    ]);
  });

  it("never stores blank text between links", () => {
    expect(textToInlines("[а](/a) [б](/b)")).toEqual([
      { type: "link", text: "а ", href: "/a" },
      { type: "link", text: "б", href: "/b" },
    ]);
  });

  it("returns no parts for empty text so the server can reject it", () => {
    expect(textToInlines("")).toEqual([]);
  });

  it("round-trips stored inlines", () => {
    const inlines = [{ type: "text", text: "Пример: " }, { type: "link", text: "източник", href: "https://example.org/a" }] as const;
    expect(textToInlines(inlinesToText(inlines))).toEqual(inlines);
  });
});
