import { describe, expect, it } from "vitest";
import { learningContentSchema, type LearningContent } from "@/features/learning/content";
import { blocksFromContent, contentFromBlocks, emptyBlock, listItemsFromText } from "./lesson-blocks";

function keys() {
  let next = 0;
  return () => `block-${next++}`;
}

const content: LearningContent = {
  version: 1,
  blocks: [
    { type: "heading", level: 2, text: "Подлог" },
    { type: "paragraph", content: [{ type: "text", text: "Виж " }, { type: "link", text: "урока", href: "/balgarski-ezik/skazuemo" }] },
    { type: "list", ordered: true, items: [[{ type: "text", text: "Първо" }], [{ type: "text", text: "Второ" }]] },
    { type: "example", title: "Пример", content: [{ type: "text", text: "Детето чете." }] },
    { type: "quotation", content: [{ type: "text", text: "Тестов цитат." }], attribution: "Тестов източник" },
  ],
};

describe("lesson blocks", () => {
  it("round-trips every stored block type", () => {
    expect(contentFromBlocks(blocksFromContent(content, keys()))).toEqual(content);
  });

  it("turns non-empty lines into list items", () => {
    expect(listItemsFromText(" едно \n\n две\n")).toEqual(["едно", "две"]);
  });

  it("produces content the server schema accepts once fields are filled", () => {
    const createKey = keys();
    const paragraph = { ...emptyBlock("paragraph", createKey()), text: "Обяснение." };
    const example = { ...emptyBlock("example", createKey()), title: "Пример", text: "Изречение." };
    expect(learningContentSchema.safeParse(contentFromBlocks([paragraph, example])).success).toBe(true);
  });

  it("leaves empty blocks for the server to reject", () => {
    expect(learningContentSchema.safeParse(contentFromBlocks([emptyBlock("paragraph", "a")])).success).toBe(false);
  });
});
