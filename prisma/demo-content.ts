import type { PrismaClient } from "../src/generated/prisma/client.ts";

/**
 * Demo records for local development only. They are invented, unreviewed examples: every
 * title and prompt starts with the demo label, slugs start with `demo-`, and question
 * provenance says the content is not verified. They must never be presented as real exam material.
 *
 * Fixed identifiers make the seed idempotent: a record that already exists is left as it is,
 * so rerunning never duplicates anything and never overwrites a developer's edits.
 */
export const demoLabel = "[ДЕМО]";

export const demoIds = {
  author: "00000000-0000-4000-8000-00000000d001",
  work: "00000000-0000-4000-8000-00000000d002",
  literatureTopic: "00000000-0000-4000-8000-00000000d003",
  languageTopic: "00000000-0000-4000-8000-00000000d004",
  languageSubtopic: "00000000-0000-4000-8000-00000000d005",
  lesson: "00000000-0000-4000-8000-00000000d006",
  multipleChoiceQuestion: "00000000-0000-4000-8000-00000000d101",
  shortResponseQuestion: "00000000-0000-4000-8000-00000000d102",
  writtenQuestion: "00000000-0000-4000-8000-00000000d103",
  literatureQuestion: "00000000-0000-4000-8000-00000000d104",
} as const;

export interface DemoSeedOptions {
  /**
   * Publishes the demo records so public pages and practice can be tried locally.
   * Questions then carry a review entry that names the seed, never a real editor.
   */
  readonly publish: boolean;
}

export interface DemoSeedResult {
  readonly created: number;
  readonly skipped: number;
}

const demoEditor = "Демо данни (непроверено съдържание)";
const demoReviewNote = "Автоматично създаден пример за разработка. Не е проверен учебен материал.";

type SeedStep = { readonly exists: () => Promise<boolean>; readonly create: () => Promise<unknown> };

export async function seedDemoContent(database: PrismaClient, options: DemoSeedOptions): Promise<DemoSeedResult> {
  const status = options.publish ? "PUBLISHED" : "DRAFT";
  const steps: SeedStep[] = [
    {
      exists: async () => (await database.author.count({ where: { id: demoIds.author } })) > 0,
      create: () => database.author.create({ data: {
        id: demoIds.author, slug: "demo-avtor", status,
        name: `${demoLabel} Примерен автор`,
        context: "Измислен автор за разработка. Текстът показва как изглежда контекстът за автор.",
      } }),
    },
    {
      exists: async () => (await database.work.count({ where: { id: demoIds.work } })) > 0,
      create: () => database.work.create({ data: {
        id: demoIds.work, slug: "demo-tvorba", status, authorId: demoIds.author,
        title: `${demoLabel} Примерна творба`,
        genre: "разказ",
        summary: "Кратко примерно резюме, което показва полето за съдържание на творбата.",
        themes: ["примерна тема", "втора примерна тема"],
        characters: ["примерен герой"],
        importantIdeas: ["примерна идея"],
        interpretation: "Примерни бележки за тълкуване. Не са истински анализ.",
      } }),
    },
    {
      exists: async () => (await database.topic.count({ where: { id: demoIds.literatureTopic } })) > 0,
      create: () => database.topic.create({ data: {
        id: demoIds.literatureTopic, slug: "demo-literatura", subject: "LITERATURE", status,
        title: `${demoLabel} Примерна литературна тема`,
      } }),
    },
    {
      exists: async () => (await database.topic.count({ where: { id: demoIds.languageTopic } })) > 0,
      create: () => database.topic.create({ data: {
        id: demoIds.languageTopic, slug: "demo-ezik", subject: "BULGARIAN_LANGUAGE", status,
        title: `${demoLabel} Примерна езикова тема`,
      } }),
    },
    {
      exists: async () => (await database.topic.count({ where: { id: demoIds.languageSubtopic } })) > 0,
      create: () => database.topic.create({ data: {
        id: demoIds.languageSubtopic, slug: "demo-ezik-podtema", subject: "BULGARIAN_LANGUAGE", status,
        parentId: demoIds.languageTopic, title: `${demoLabel} Примерна подтема`,
      } }),
    },
    {
      exists: async () => (await database.lesson.count({ where: { id: demoIds.lesson } })) > 0,
      create: () => database.lesson.create({ data: {
        id: demoIds.lesson, slug: "demo-urok", status, topicId: demoIds.languageSubtopic,
        title: `${demoLabel} Примерен урок`,
        content: {
          version: 1,
          blocks: [
            { type: "heading", level: 2, text: "Какво показва този урок" },
            { type: "paragraph", content: [{ type: "text", text: "Това е примерно обяснение за разработка. То не е проверен учебен материал." }] },
            { type: "example", title: "Пример", content: [{ type: "text", text: "Примерно изречение за илюстрация." }] },
            { type: "list", ordered: false, items: [[{ type: "text", text: "първа точка" }], [{ type: "text", text: "втора точка" }]] },
          ],
        },
      } }),
    },
    {
      exists: () => questionExists(database, demoIds.multipleChoiceQuestion),
      create: () => createMultipleChoice(database, {
        id: demoIds.multipleChoiceQuestion, subject: "BULGARIAN_LANGUAGE",
        prompt: `${demoLabel} Коя от думите е съществително име?`,
        explanation: "„Маса“ назовава предмет, затова е съществително име.",
        options: ["бягам", "маса", "бързо"], correctPosition: 1,
        // Two topics show how one bank question appears under a topic and its subtopic.
        topicIds: [demoIds.languageTopic, demoIds.languageSubtopic],
      }, options),
    },
    {
      exists: () => questionExists(database, demoIds.shortResponseQuestion),
      create: () => createQuestion(database, {
        id: demoIds.shortResponseQuestion, subject: "BULGARIAN_LANGUAGE", type: "SHORT_RESPONSE", assessmentMode: "OBJECTIVE",
        prompt: `${demoLabel} Напиши множественото число на „град“.`,
        maximumPoints: 2,
        explanation: "Множественото число е „градове“.",
        acceptedAnswers: ["градове"],
      }, [demoIds.languageSubtopic], options),
    },
    {
      exists: () => questionExists(database, demoIds.writtenQuestion),
      create: () => createQuestion(database, {
        id: demoIds.writtenQuestion, subject: "BULGARIAN_LANGUAGE", type: "EXTENDED_RESPONSE", assessmentMode: "SELF_REVIEW",
        prompt: `${demoLabel} Опиши в няколко изречения любимото си място.`,
        referenceGuidance: "Примерни насоки: ясно начало, конкретни подробности и завършек.",
        rubric: [
          { id: "demo-criterion-structure", description: "Текстът има начало, основна част и завършек.", indicativePoints: 2 },
          { id: "demo-criterion-detail", description: "Използвани са конкретни подробности." },
        ],
      }, [demoIds.languageSubtopic], options),
    },
    {
      exists: () => questionExists(database, demoIds.literatureQuestion),
      create: () => createMultipleChoice(database, {
        id: demoIds.literatureQuestion, subject: "LITERATURE",
        prompt: `${demoLabel} Към кой жанр е примерната творба?`,
        explanation: "В демо данните творбата е отбелязана като разказ.",
        options: ["разказ", "поема"], correctPosition: 0,
        topicIds: [demoIds.literatureTopic], workId: demoIds.work,
      }, options),
    },
  ];

  let created = 0;
  for (const step of steps) {
    if (await step.exists()) continue;
    await step.create();
    created += 1;
  }
  return { created, skipped: steps.length - created };
}

async function questionExists(database: PrismaClient, id: string): Promise<boolean> {
  return (await database.question.count({ where: { id } })) > 0;
}

interface QuestionFields {
  readonly id: string;
  readonly subject: "BULGARIAN_LANGUAGE" | "LITERATURE";
  readonly type: "SHORT_RESPONSE" | "EXTENDED_RESPONSE";
  readonly assessmentMode: "OBJECTIVE" | "SELF_REVIEW";
  readonly prompt: string;
  readonly maximumPoints?: number;
  readonly explanation?: string;
  readonly acceptedAnswers?: string[];
  readonly referenceGuidance?: string;
  readonly rubric?: { id: string; description: string; indicativePoints?: number }[];
}

/** Creates the question as a draft with its links and provenance, then publishes it when asked. */
async function createQuestion(database: PrismaClient, fields: QuestionFields, topicIds: readonly string[], options: DemoSeedOptions) {
  await database.$transaction(async (transaction) => {
    await transaction.question.create({ data: { ...fields, status: "DRAFT", provenance: { create: demoProvenance(options) } } });
    await transaction.questionTopic.createMany({ data: topicIds.map((topicId) => ({ questionId: fields.id, topicId, subject: fields.subject })) });
    if (options.publish) await transaction.question.update({ where: { id: fields.id }, data: { status: "PUBLISHED" } });
  });
}

interface MultipleChoiceFields {
  readonly id: string;
  readonly subject: "BULGARIAN_LANGUAGE" | "LITERATURE";
  readonly prompt: string;
  readonly explanation: string;
  readonly options: readonly string[];
  readonly correctPosition: number;
  readonly topicIds: readonly string[];
  readonly workId?: string;
}

async function createMultipleChoice(database: PrismaClient, fields: MultipleChoiceFields, options: DemoSeedOptions) {
  await database.$transaction(async (transaction) => {
    const question = await transaction.question.create({
      data: {
        id: fields.id, subject: fields.subject, type: "MULTIPLE_CHOICE", assessmentMode: "OBJECTIVE",
        prompt: fields.prompt, explanation: fields.explanation, maximumPoints: 1, status: "DRAFT",
        options: { create: fields.options.map((text, position) => ({ text, position })) },
        provenance: { create: demoProvenance(options) },
      },
      include: { options: true },
    });
    const correct = question.options.find((option) => option.position === fields.correctPosition);
    if (!correct) throw new Error(`Demo question ${fields.id} has no option at position ${fields.correctPosition}.`);
    await transaction.question.update({ where: { id: fields.id }, data: { correctOptionId: correct.id } });
    await transaction.questionTopic.createMany({ data: fields.topicIds.map((topicId) => ({ questionId: fields.id, topicId, subject: fields.subject })) });
    if (fields.workId) await transaction.questionWork.create({ data: { questionId: fields.id, workId: fields.workId } });
    if (options.publish) await transaction.question.update({ where: { id: fields.id }, data: { status: "PUBLISHED" } });
  });
}

/**
 * Publishing requires a recorded review. When publishing locally, the review names the seed
 * itself and says the content is unverified, so it can never be mistaken for an editor's review.
 */
function demoProvenance(options: DemoSeedOptions) {
  return {
    origin: "ORIGINAL" as const,
    editorName: demoEditor,
    reviewStatus: options.publish ? ("REVIEWED" as const) : ("UNREVIEWED" as const),
    reviewedBy: options.publish ? demoEditor : null,
    reviewedAt: options.publish ? new Date() : null,
    reviewNotes: demoReviewNote,
  };
}
