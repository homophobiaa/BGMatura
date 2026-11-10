import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import type { LearningKind } from "@/features/learning/kinds";
import { getDatabase } from "@/server/database";
import { learningListPageSize, type LearningListFilters } from "../learning-list-filters";
import { requireAdmin } from "./authorization";

export type LearningListItem = {
  id: string;
  title: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED";
  updatedAt: string;
  /** Short secondary context: the author of a work, the subject of a topic, the topic of a lesson. */
  detail: string | null;
};

export type LearningListPage = { items: LearningListItem[]; total: number; page: number; pageCount: number };

const subjectLabels = { BULGARIAN_LANGUAGE: "Български език", LITERATURE: "Литература" } as const;

/** Lists every record of one kind for editors, newest change first, with stable pagination. */
export async function listLearningRecords(kind: LearningKind, filters: LearningListFilters, requestHeaders: Headers, database?: PrismaClient): Promise<LearningListPage> {
  await requireAdmin(requestHeaders);
  const connection = database ?? getDatabase();
  const status = filters.status === "all" ? {} : { status: filters.status };
  const contains = filters.query ? { contains: filters.query, mode: "insensitive" as const } : undefined;
  const orderBy = [{ updatedAt: "desc" as const }, { id: "asc" as const }];

  async function paginate<T>(count: () => Promise<number>, read: (skip: number) => Promise<T[]>, toItem: (record: T) => LearningListItem) {
    const total = await count();
    const pageCount = Math.max(1, Math.ceil(total / learningListPageSize));
    const page = Math.min(filters.page, pageCount);
    const records = await read((page - 1) * learningListPageSize);
    return { items: records.map(toItem), total, page, pageCount };
  }

  switch (kind) {
    case "author": {
      const where = { ...status, ...(contains && { OR: [{ name: contains }, { slug: contains }] }) };
      return paginate(() => connection.author.count({ where }),
        (skip) => connection.author.findMany({ where, orderBy, skip, take: learningListPageSize }),
        (author) => ({ id: author.id, title: author.name, slug: author.slug, status: author.status, updatedAt: author.updatedAt.toISOString(), detail: null }));
    }
    case "work": {
      const where = { ...status, ...(contains && { OR: [{ title: contains }, { slug: contains }] }) };
      return paginate(() => connection.work.count({ where }),
        (skip) => connection.work.findMany({ where, orderBy, skip, take: learningListPageSize, include: { author: { select: { name: true } } } }),
        (work) => ({ id: work.id, title: work.title, slug: work.slug, status: work.status, updatedAt: work.updatedAt.toISOString(), detail: work.author.name }));
    }
    case "topic": {
      const where = { ...status, ...(contains && { OR: [{ title: contains }, { slug: contains }] }) };
      return paginate(() => connection.topic.count({ where }),
        (skip) => connection.topic.findMany({ where, orderBy, skip, take: learningListPageSize }),
        (topic) => ({ id: topic.id, title: topic.title, slug: topic.slug, status: topic.status, updatedAt: topic.updatedAt.toISOString(), detail: subjectLabels[topic.subject] }));
    }
    case "lesson": {
      const where = { ...status, ...(contains && { OR: [{ title: contains }, { slug: contains }] }) };
      return paginate(() => connection.lesson.count({ where }),
        (skip) => connection.lesson.findMany({ where, orderBy, skip, take: learningListPageSize, include: { topic: { select: { title: true } } } }),
        (lesson) => ({ id: lesson.id, title: lesson.title, slug: lesson.slug, status: lesson.status, updatedAt: lesson.updatedAt.toISOString(), detail: lesson.topic.title }));
    }
  }
}

export type AuthorOption = { id: string; name: string; status: "DRAFT" | "PUBLISHED" };
export type TopicOption = { id: string; title: string; parentId: string | null; subject: "BULGARIAN_LANGUAGE" | "LITERATURE"; status: "DRAFT" | "PUBLISHED" };

/** Choices for the work editor's author field. Editors see drafts too. */
export async function listAuthorOptions(requestHeaders: Headers, database?: PrismaClient): Promise<AuthorOption[]> {
  await requireAdmin(requestHeaders);
  return (database ?? getDatabase()).author.findMany({ orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, status: true } });
}

/** Choices for topic parents and lesson topics. */
export async function listTopicOptions(requestHeaders: Headers, database?: PrismaClient): Promise<TopicOption[]> {
  await requireAdmin(requestHeaders);
  return (database ?? getDatabase()).topic.findMany({
    orderBy: [{ subject: "asc" }, { position: "asc" }, { title: "asc" }, { id: "asc" }],
    select: { id: true, title: true, parentId: true, subject: true, status: true },
  });
}
