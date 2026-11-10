import type { LearningContent } from "@/features/learning/content";
import { inlinesToText, textToInlines } from "./inline-text";

/**
 * The lesson form edits blocks as plain text fields. These helpers convert between
 * that editing shape and the stored learning content format. The server validates
 * the result; the form only shapes it.
 */
export type EditableBlock =
  | { key: string; type: "paragraph"; text: string }
  | { key: string; type: "heading"; level: 2 | 3; text: string }
  | { key: string; type: "list"; ordered: boolean; itemsText: string }
  | { key: string; type: "example"; title: string; text: string }
  | { key: string; type: "quotation"; text: string; attribution: string };

export type EditableBlockType = EditableBlock["type"];

export const blockTypeLabels: Record<EditableBlockType, string> = {
  paragraph: "Абзац",
  heading: "Заглавие",
  list: "Списък",
  example: "Пример",
  quotation: "Цитат",
};

export function emptyBlock(type: EditableBlockType, key: string): EditableBlock {
  switch (type) {
    case "paragraph": return { key, type, text: "" };
    case "heading": return { key, type, level: 2, text: "" };
    case "list": return { key, type, ordered: false, itemsText: "" };
    case "example": return { key, type, title: "", text: "" };
    case "quotation": return { key, type, text: "", attribution: "" };
  }
}

export function blocksFromContent(content: LearningContent, createKey: () => string): EditableBlock[] {
  return content.blocks.map((block): EditableBlock => {
    const key = createKey();
    switch (block.type) {
      case "paragraph": return { key, type: "paragraph", text: inlinesToText(block.content) };
      case "heading": return { key, type: "heading", level: block.level, text: block.text };
      case "list": return { key, type: "list", ordered: block.ordered, itemsText: block.items.map(inlinesToText).join("\n") };
      case "example": return { key, type: "example", title: block.title, text: inlinesToText(block.content) };
      case "quotation": return { key, type: "quotation", text: inlinesToText(block.content), attribution: block.attribution };
    }
  });
}

/** Each non-empty line of a list field is one list item. */
export function listItemsFromText(itemsText: string): string[] {
  return itemsText.split("\n").map((line) => line.trim()).filter(Boolean);
}

export function contentFromBlocks(blocks: readonly EditableBlock[]): LearningContent {
  return {
    version: 1,
    blocks: blocks.map((block): LearningContent["blocks"][number] => {
      switch (block.type) {
        case "paragraph": return { type: "paragraph", content: textToInlines(block.text) };
        case "heading": return { type: "heading", level: block.level, text: block.text };
        case "list": return { type: "list", ordered: block.ordered, items: listItemsFromText(block.itemsText).map(textToInlines) };
        case "example": return { type: "example", title: block.title, content: textToInlines(block.text) };
        case "quotation": return { type: "quotation", content: textToInlines(block.text), attribution: block.attribution };
      }
    }),
  };
}
