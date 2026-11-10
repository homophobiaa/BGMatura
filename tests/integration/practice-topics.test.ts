import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/server/database";
import { findPracticeTopic, listPracticeTopics, listPracticeTopicsForWork, listTopicLessons } from "@/features/practice/server/practice-topics";

const database = getDatabase();
const prefix = `practice-topics-${randomUUID()}`;
const topicIds: string[] = [];
const questionIds: string[] = [];
let languageTopic: string;
let literatureTopic: string;
let draftTopic: string;
let emptyTopic: string;
let draftChildTopic: string;
let workId: string;
let authorId: string;

async function topic(subject: "BULGARIAN_LANGUAGE" | "LITERATURE", status: "DRAFT" | "PUBLISHED", parentId: string | null = null) {
  const created = await database.topic.create({ data: { title: `${prefix} ${topicIds.length}`, slug: `${prefix}-${topicIds.length}`, subject, status, parentId } });
  topicIds.push(created.id);
  return created.id;
}

async function question(subject: "BULGARIAN_LANGUAGE" | "LITERATURE", topicId: string, status: "DRAFT" | "PUBLISHED" = "PUBLISHED") {
  const created = await database.question.create({ data: {
    subject, status, type: "SHORT_RESPONSE", assessmentMode: "OBJECTIVE", prompt: `${prefix} въпрос`,
    maximumPoints: 1, explanation: "Само тестови данни.", acceptedAnswers: ["тест"],
  } });
  questionIds.push(created.id);
  await database.questionTopic.create({ data: { questionId: created.id, topicId, subject } });
  return created.id;
}

beforeAll(async () => {
  languageTopic = await topic("BULGARIAN_LANGUAGE", "PUBLISHED");
  await question("BULGARIAN_LANGUAGE", languageTopic);
  await question("BULGARIAN_LANGUAGE", languageTopic);
  await question("BULGARIAN_LANGUAGE", languageTopic, "DRAFT");
  await database.lesson.create({ data: { title: `${prefix} урок`, slug: `${prefix}-lesson`, topicId: languageTopic, status: "PUBLISHED",
    content: { version: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text: "Тест." }] }, { type: "example", title: "Пример", content: [{ type: "text", text: "Тест." }] }] } } });
  await database.lesson.create({ data: { title: `${prefix} чернова`, slug: `${prefix}-draft-lesson`, topicId: languageTopic } });

  draftTopic = await topic("BULGARIAN_LANGUAGE", "DRAFT");
  await question("BULGARIAN_LANGUAGE", draftTopic);
  draftChildTopic = await topic("BULGARIAN_LANGUAGE", "PUBLISHED", draftTopic);
  await question("BULGARIAN_LANGUAGE", draftChildTopic);
  emptyTopic = await topic("BULGARIAN_LANGUAGE", "PUBLISHED");
  await question("BULGARIAN_LANGUAGE", emptyTopic, "DRAFT");

  literatureTopic = await topic("LITERATURE", "PUBLISHED");
  const author = await database.author.create({ data: { name: `${prefix} автор`, slug: `${prefix}-author`, status: "PUBLISHED", context: "Тест." } });
  authorId = author.id;
  const work = await database.work.create({ data: { title: `${prefix} произведение`, slug: `${prefix}-work`, authorId,
    status: "PUBLISHED", genre: "Тест", summary: "Тест", interpretation: "Тест", themes: ["Тест"], importantIdeas: ["Тест"] } });
  workId = work.id;
  const linked = await question("LITERATURE", literatureTopic);
  await database.questionWork.create({ data: { questionId: linked, workId, subject: "LITERATURE" } });
});

afterAll(async () => {
  await database.questionWork.deleteMany({ where: { questionId: { in: questionIds } } });
  await database.questionTopic.deleteMany({ where: { questionId: { in: questionIds } } });
  await database.question.deleteMany({ where: { id: { in: questionIds } } });
  await database.lesson.deleteMany({ where: { slug: { startsWith: prefix } } });
  await database.work.deleteMany({ where: { id: workId } });
  await database.author.deleteMany({ where: { id: authorId } });
  for (const id of topicIds.toReversed()) await database.topic.delete({ where: { id } });
});

describe("practice topics", () => {
  it("list only visible topics with usable published questions", async () => {
    const mine = (await listPracticeTopics()).filter((item) => topicIds.includes(item.id));
    expect(mine.map((item) => item.id).sort()).toEqual([languageTopic, literatureTopic].sort());
    expect(mine.find((item) => item.id === languageTopic)).toMatchObject({ questionCount: 2, subject: "BULGARIAN_LANGUAGE", lessons: [{ slug: `${prefix}-lesson` }] });
  });

  it("hide drafts, children of drafts, and topics without published questions", async () => {
    expect(await findPracticeTopic(draftTopic)).toBeNull();
    expect(await findPracticeTopic(draftChildTopic)).toBeNull();
    expect(await findPracticeTopic(emptyTopic)).toBeNull();
  });

  it("link a work to the topics of its questions", async () => {
    expect((await listPracticeTopicsForWork(workId)).map((item) => item.id)).toEqual([literatureTopic]);
  });

  it("list only published lessons of a visible topic", async () => {
    expect(await listTopicLessons(languageTopic)).toEqual([{ title: `${prefix} урок`, slug: `${prefix}-lesson` }]);
    expect(await listTopicLessons(draftChildTopic)).toEqual([]);
  });
});
