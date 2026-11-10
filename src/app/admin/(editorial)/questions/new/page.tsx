import type { Metadata } from "next";
import { requireAdminPage } from "@/features/admin/server/page-authorization";
import { QuestionEditorPage } from "../question-editor-page";

export const metadata: Metadata = { title: "Нов въпрос — BG Matura", robots: { index: false, follow: false } };

export default async function NewQuestionPage() {
  const { requestHeaders } = await requireAdminPage();
  return <QuestionEditorPage record={undefined} created={false} requestHeaders={requestHeaders} />;
}
