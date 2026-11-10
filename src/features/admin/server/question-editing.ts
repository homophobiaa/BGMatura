import "server-only";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import type { QuestionFormRecord } from "../components/question-form";
import type { QuestionEditorState } from "../question-draft";
import { getDatabase } from "@/server/database";
import { questionListPageSize, type QuestionListFilters, type QuestionTypeValue } from "../question-list-filters";
import { requireAdmin } from "./authorization";

export type QuestionListItem = {
  id: string; prompt: string; type: QuestionTypeValue; assessmentMode: "OBJECTIVE" | "SELF_REVIEW" | "UNGRADED";
  status: "DRAFT" | "PUBLISHED"; updatedAt: string; topics: string[];
};

/** Editor list of bank questions, newest change first. */
export async function listQuestions(filters: QuestionListFilters, requestHeaders: Headers, database?: PrismaClient) {
  await requireAdmin(requestHeaders);
  const connection = database ?? getDatabase();
  const where = {
    ...(filters.status === "all" ? {} : { status: filters.status }),
    ...(filters.type === "all" ? {} : { type: filters.type }),
    ...(filters.topicId ? { topics: { some: { topicId: filters.topicId } } } : {}),
    ...(filters.query ? { prompt: { contains: filters.query, mode: "insensitive" as const } } : {}),
  };
  const total = await connection.question.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / questionListPageSize));
  const page = Math.min(filters.page, pageCount);
  const records = await connection.question.findMany({
    where, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], skip: (page - 1) * questionListPageSize, take: questionListPageSize,
    select: { id: true, prompt: true, type: true, assessmentMode: true, status: true, updatedAt: true, topics: { select: { topic: { select: { title: true } } } } },
  });
  const items: QuestionListItem[] = records.map((record) => ({
    id: record.id, prompt: record.prompt, type: record.type, assessmentMode: record.assessmentMode, status: record.status,
    updatedAt: record.updatedAt.toISOString(), topics: record.topics.map(({ topic }) => topic.title),
  }));
  return { items, total, page, pageCount };
}

/**
 * The full saved question for its editor and its protected preview, including the
 * answer key and guidance. Only admins reach this, and it never feeds a public page.
 */
export async function readQuestionForEditor(id: string, requestHeaders: Headers, database?: PrismaClient) {
  await requireAdmin(requestHeaders);
  return (database ?? getDatabase()).question.findUnique({
    where: { id },
    include: {
      options: { orderBy: { position: "asc" } },
      topics: { select: { topicId: true } },
      works: { select: { workId: true } },
      provenance: true,
    },
  });
}

export type WorkOption = { id: string; title: string; status: "DRAFT" | "PUBLISHED" };

export async function listWorkOptions(requestHeaders: Headers, database?: PrismaClient): Promise<WorkOption[]> {
  await requireAdmin(requestHeaders);
  return (database ?? getDatabase()).work.findMany({ orderBy: [{ title: "asc" }, { id: "asc" }], select: { id: true, title: true, status: true } });
}

type EditorQuestion = NonNullable<Awaited<ReturnType<typeof readQuestionForEditor>>>;

const rubricSchema = z.array(z.object({ id: z.string(), description: z.string(), indicativePoints: z.number().optional() }));

/** Converts the saved question into the editor's plain working state. */
export function toQuestionFormRecord(question: EditorQuestion): QuestionFormRecord {
  const rubric = rubricSchema.safeParse(question.rubric);
  const correctIndex = question.options.findIndex((option) => option.id === question.correctOptionId);
  const state: QuestionEditorState = {
    subject: question.subject,
    type: question.type,
    assessmentMode: question.assessmentMode,
    prompt: question.prompt,
    maximumPoints: question.maximumPoints === null ? "" : question.maximumPoints.toNumber().toLocaleString("bg-BG", { useGrouping: false, maximumFractionDigits: 2 }),
    explanation: question.explanation ?? "",
    acceptedAnswersText: question.acceptedAnswers.join("\n"),
    options: question.options.map((option, index) => ({ key: `saved-${index}`, text: option.text })),
    correctOptionKey: correctIndex === -1 ? null : `saved-${correctIndex}`,
    referenceGuidance: question.referenceGuidance ?? "",
    rubric: (rubric.success ? rubric.data : []).map((criterion, index) => ({
      key: `saved-${index}`, id: criterion.id, description: criterion.description,
      indicativePoints: criterion.indicativePoints === undefined ? "" : criterion.indicativePoints.toLocaleString("bg-BG", { useGrouping: false }),
    })),
    topicIds: question.topics.map(({ topicId }) => topicId),
    workIds: question.works.map(({ workId }) => workId),
    provenance: {
      origin: question.provenance?.origin ?? "ORIGINAL",
      editorName: question.provenance?.editorName ?? "",
      attribution: question.provenance?.attribution ?? "",
      sourceReference: question.provenance?.sourceReference ?? "",
      reviewNotes: question.provenance?.reviewNotes ?? "",
      reviewed: question.provenance?.reviewStatus === "REVIEWED",
    },
  };
  return { id: question.id, status: question.status, updatedAt: question.updatedAt.toISOString(), state };
}
