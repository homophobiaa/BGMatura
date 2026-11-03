import type { LearningContent } from "../../src/features/learning/content";

/** Synthetic, unverified editorial format example, used only in tests. */
export const exampleLessonContent = {
  version: 1,
  blocks: [
    { type: "heading", level: 2, text: "Правило" },
    { type: "paragraph", content: [{ type: "text", text: "Тестово правило, не е учебен материал." }] },
    { type: "example", title: "Пример", content: [{ type: "text", text: "Тестов пример." }] },
  ],
} satisfies LearningContent;
