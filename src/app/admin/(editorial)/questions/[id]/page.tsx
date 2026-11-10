import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdminPage } from "@/features/admin/server/page-authorization";
import { readQuestionForEditor, toQuestionFormRecord } from "@/features/admin/server/question-editing";
import { QuestionEditorPage } from "../question-editor-page";

export const metadata: Metadata = { title: "Редакция на въпрос — BG Matura", robots: { index: false, follow: false } };

export default async function EditQuestionPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { requestHeaders } = await requireAdminPage();
  const question = await readQuestionForEditor(id, requestHeaders);
  if (!question) notFound();
  return <QuestionEditorPage record={toQuestionFormRecord(question)} created={(await searchParams).created === "1"} requestHeaders={requestHeaders} />;
}
