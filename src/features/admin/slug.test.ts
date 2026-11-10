import { describe, expect, it } from "vitest";
import { slugFromTitle } from "./slug";

describe("slugFromTitle", () => {
  it("transliterates Bulgarian titles with the official rules", () => {
    expect(slugFromTitle("Под игото")).toBe("pod-igoto");
    expect(slugFromTitle("Христо Ботев")).toBe("hristo-botev");
    expect(slugFromTitle("Щастие и юначество")).toBe("shtastie-i-yunachestvo");
  });

  it("writes a word-final ия as ia", () => {
    expect(slugFromTitle("История на Мария")).toBe("istoria-na-maria");
  });

  it("drops punctuation and collapses separators", () => {
    expect(slugFromTitle("  „Бай Ганьо“ — пътувания!  ")).toBe("bay-ganyo-patuvania");
    expect(slugFromTitle("Глава 2: Ред")).toBe("glava-2-red");
  });

  it("returns an empty slug when nothing usable remains", () => {
    expect(slugFromTitle("— !")).toBe("");
  });
});
