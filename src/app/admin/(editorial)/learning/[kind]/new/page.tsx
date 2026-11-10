import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/features/admin/server/page-authorization";
import { isLearningKind } from "@/features/learning/kinds";
import { LearningEditorPage } from "../editor-page";

export const metadata: Metadata = { title: "Нов запис — BG Matura", robots: { index: false, follow: false } };

export default async function NewLearningRecordPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!isLearningKind(kind)) notFound();
  const { requestHeaders } = await requireAdminPage();
  return <LearningEditorPage kind={kind} editing={undefined} created={false} requestHeaders={requestHeaders} />;
}
