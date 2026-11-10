import "server-only";
import { z } from "zod";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { learningContentSchema } from "../content";
import { learningKinds } from "../kinds";
import { EditorialError, editorialId, editorialMutation, parseEditorialInput } from "@/server/editorial";

export const learningKindSchema = z.enum(learningKinds);
export type { LearningKind } from "../kinds";
const publicationSchema = z.strictObject({ kind: learningKindSchema, id: editorialId, publish: z.boolean() });
export type FieldProblems = Record<string, string[]>;

export function authorPublicationProblems(author: { name: string; context: string | null }): FieldProblems {
  const fields: FieldProblems = {};
  if (!author.name.trim()) fields.name = ["Write the author's name."];
  if (!author.context?.trim()) fields.context = ["Add the author's context."];
  return fields;
}

export function workPublicationProblems(work: { title: string; genre: string | null; summary: string | null; interpretation: string | null; themes: string[]; importantIdeas: string[]; author: { status: string } }): FieldProblems {
  const fields: FieldProblems = {};
  if (!work.title.trim()) fields.title = ["Write the work title."];
  if (!work.genre?.trim()) fields.genre = ["Add a genre."];
  if (!work.summary?.trim()) fields.summary = ["Add a summary."];
  if (!work.interpretation?.trim()) fields.interpretation = ["Add interpretation notes."];
  if (!work.themes.length) fields.themes = ["Add at least one key theme."];
  if (!work.importantIdeas.length) fields.importantIdeas = ["Add at least one important idea."];
  if (work.author.status !== "PUBLISHED") fields.authorId = ["Publish the author first."];
  return fields;
}

export function lessonPublicationProblems(content: unknown): FieldProblems {
  const parsed = learningContentSchema.safeParse(content);
  if (!parsed.success) return { content: ["Fix the structured content and unsafe links."] };
  const blocks = parsed.data.blocks;
  if (!blocks.some((block) => block.type === "paragraph") || !blocks.some((block) => block.type === "example")) {
    return { content: ["Include an explanation paragraph and an illustrative example."] };
  }
  return {};
}

export async function requirePublishedTopicAncestry(database: Prisma.TransactionClient, topicId: string | null): Promise<void> {
  const seen = new Set<string>();
  while (topicId) {
    if (seen.has(topicId)) throw new EditorialError("invalid", "The topic hierarchy is invalid.", { topicId: ["Fix the topic hierarchy."] });
    seen.add(topicId);
    const topic = await database.topic.findUnique({ where: { id: topicId }, select: { parentId: true, status: true } });
    if (!topic || topic.status !== "PUBLISHED") throw new EditorialError("invalid", "Publish the topic and its ancestors first.", { topicId: ["A required topic is unpublished or missing."] });
    topicId = topic.parentId;
  }
}

function requireReady(fields: FieldProblems) {
  if (Object.keys(fields).length) throw new EditorialError("invalid", "Complete the required publication fields.", fields);
}

export function setLearningPublication(input: unknown, requestHeaders: Headers, database?: PrismaClient) {
  return editorialMutation(requestHeaders, async (transaction) => {
    const { kind, id, publish } = parseEditorialInput(publicationSchema, input);
    const status = publish ? "PUBLISHED" : "DRAFT";
    switch (kind) {
      case "author": {
        const author = await transaction.author.findUniqueOrThrow({ where: { id } });
        if (publish) requireReady(authorPublicationProblems(author));
        return transaction.author.update({ where: { id }, data: { status }, select: { id: true, slug: true, status: true, updatedAt: true } });
      }
      case "work": {
        const work = await transaction.work.findUniqueOrThrow({ where: { id }, include: { author: { select: { status: true } } } });
        if (publish) requireReady(workPublicationProblems(work));
        return transaction.work.update({ where: { id }, data: { status }, select: { id: true, slug: true, status: true, updatedAt: true } });
      }
      case "topic": {
        const topic = await transaction.topic.findUniqueOrThrow({ where: { id } });
        if (publish) await requirePublishedTopicAncestry(transaction, topic.parentId);
        return transaction.topic.update({ where: { id }, data: { status }, select: { id: true, slug: true, status: true, updatedAt: true } });
      }
      case "lesson": {
        const lesson = await transaction.lesson.findUniqueOrThrow({ where: { id } });
        if (publish) {
          requireReady(lessonPublicationProblems(lesson.content));
          await requirePublishedTopicAncestry(transaction, lesson.topicId);
        }
        return transaction.lesson.update({ where: { id }, data: { status }, select: { id: true, slug: true, status: true, updatedAt: true } });
      }
    }
  }, database);
}
