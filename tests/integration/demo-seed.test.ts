import { describe, expect, it } from "vitest";

import { demoIds, demoLabel, seedDemoContent } from "../../prisma/demo-content";
import { getDatabase } from "@/server/database";
import { findQuestionPublicationProblems } from "@/features/questions/server/question-publication";

const questionIds = [demoIds.multipleChoiceQuestion, demoIds.shortResponseQuestion, demoIds.writtenQuestion, demoIds.literatureQuestion];

async function removeDemoContent() {
  const database = getDatabase();
  await database.question.deleteMany({ where: { id: { in: questionIds } } });
  await database.lesson.deleteMany({ where: { id: demoIds.lesson } });
  await database.work.deleteMany({ where: { id: demoIds.work } });
  await database.topic.deleteMany({ where: { id: demoIds.languageSubtopic } });
  await database.topic.deleteMany({ where: { id: { in: [demoIds.languageTopic, demoIds.literatureTopic] } } });
  await database.author.deleteMany({ where: { id: demoIds.author } });
}

describe("demo seed", () => {
  it("creates labelled, linked demo records once and is safe to rerun", async () => {
    await removeDemoContent();
    try {
      const first = await seedDemoContent(getDatabase(), { publish: true });
      const second = await seedDemoContent(getDatabase(), { publish: true });
      expect(first).toEqual({ created: 10, skipped: 0 });
      expect(second).toEqual({ created: 0, skipped: 10 });

      const questions = await getDatabase().question.findMany({ where: { id: { in: questionIds } }, include: { topics: true, provenance: true } });
      expect(questions).toHaveLength(4);
      for (const question of questions) {
        expect(question.prompt.startsWith(demoLabel)).toBe(true);
        expect(question.status).toBe("PUBLISHED");
        expect(question.provenance?.reviewNotes).toMatch(/Не е проверен/);
        expect(await findQuestionPublicationProblems(question.id)).toEqual([]);
      }
      expect(questions.find((question) => question.id === demoIds.multipleChoiceQuestion)?.topics).toHaveLength(2);
    } finally {
      await removeDemoContent();
    }
  });

  it("keeps demo records as unreviewed drafts by default", async () => {
    await removeDemoContent();
    try {
      await seedDemoContent(getDatabase(), { publish: false });
      const published = await getDatabase().question.count({ where: { id: { in: questionIds }, status: "PUBLISHED" } });
      const lesson = await getDatabase().lesson.findUniqueOrThrow({ where: { id: demoIds.lesson } });
      expect(published).toBe(0);
      expect(lesson.status).toBe("DRAFT");
    } finally {
      await removeDemoContent();
    }
  });
});
