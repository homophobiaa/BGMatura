import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Feedback } from "@/components/ui/feedback";
import { requireAdminPage } from "@/features/admin/server/page-authorization";
import { learningContentSchema } from "@/features/learning/content";
import { isLearningKind } from "@/features/learning/kinds";
import { readLearningPreview } from "@/features/learning/server/previews";
import { Prisma } from "@/generated/prisma/client";
import { EditorialError } from "@/server/editorial";
import { LearningEditorPage, type EditorRecord } from "../editor-page";

export const metadata: Metadata = { title: "Редакция — BG Matura", robots: { index: false, follow: false } };

export default async function EditLearningRecordPage({ params, searchParams }: {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { kind, id } = await params;
  if (!isLearningKind(kind)) notFound();
  const { requestHeaders } = await requireAdminPage();
  const preview = await readLearningPreview(kind, id, requestHeaders).catch((error: unknown) => {
    if (error instanceof EditorialError || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025")) notFound();
    throw error;
  });
  const editing = toEditorRecord(preview);
  if (!editing) {
    return <Feedback tone="error">Съдържанието на този урок е в неочакван формат и не може да се редактира тук.</Feedback>;
  }
  const created = (await searchParams).created === "1";
  return <LearningEditorPage kind={kind} editing={editing} created={created} requestHeaders={requestHeaders} />;
}

/** Converts the saved record into plain form data; Dates become ISO strings for conflict checks. */
function toEditorRecord(preview: Awaited<ReturnType<typeof readLearningPreview>>): EditorRecord | undefined {
  switch (preview.kind) {
    case "author": {
      const { id, name, slug, context, status, updatedAt } = preview.record;
      return { kind: "author", record: { id, name, slug, context, status, updatedAt: updatedAt.toISOString() } };
    }
    case "work": {
      const { id, title, slug, authorId, genre, summary, themes, characters, importantIdeas, interpretation, status, updatedAt } = preview.record;
      return { kind: "work", record: { id, title, slug, authorId, genre, summary, themes, characters, importantIdeas, interpretation, status, updatedAt: updatedAt.toISOString() } };
    }
    case "topic": {
      const { id, title, slug, subject, parentId, position, status, updatedAt } = preview.record;
      return { kind: "topic", record: { id, title, slug, subject, parentId, position, status, updatedAt: updatedAt.toISOString() } };
    }
    case "lesson": {
      const { id, title, slug, topicId, content, status, updatedAt } = preview.record;
      const parsed = learningContentSchema.safeParse(content);
      if (!parsed.success) return undefined;
      return { kind: "lesson", record: { id, title, slug, topicId, content: parsed.data, status, updatedAt: updatedAt.toISOString() } };
    }
  }
}
