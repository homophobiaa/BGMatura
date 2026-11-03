import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { LearningContent, StudyText } from "@/components/learning-content";
import { Feedback } from "@/components/ui/feedback";
import { AdminAuthorizationError } from "@/features/admin/server/authorization";
import { AdminConfigurationError } from "@/features/admin/server/environment";
import { readLearningPreview } from "@/features/learning/server/previews";
import { Prisma } from "@/generated/prisma/client";
import { EditorialError } from "@/server/editorial";

export const metadata: Metadata = { title: "Редакторски преглед — BG Matura", robots: { index: false, follow: false } };

export default async function LearningPreviewPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const preview = await readLearningPreview(kind, id, new Headers(await headers())).catch((error: unknown) => {
    if (error instanceof AdminAuthorizationError || error instanceof AdminConfigurationError) redirect("/admin/sign-in");
    if (error instanceof EditorialError || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025")) notFound();
    throw error;
  });
  return <article className="max-w-reading space-y-8">
    <Feedback tone="warning">Редакторски преглед · {preview.record.status === "DRAFT" ? "Чернова" : "Публикуван материал"}. Това не е публична страница.</Feedback>
    {preview.kind === "author" && <><h1>{preview.record.name}</h1>{preview.record.context && <StudyText text={preview.record.context} />}</>}
    {preview.kind === "topic" && <h1>{preview.record.title}</h1>}
    {preview.kind === "lesson" && <><h1>{preview.record.title}</h1><p>{preview.record.topic.title}</p><LearningContent content={preview.record.content} /></>}
    {preview.kind === "work" && <>
      <h1>{preview.record.title}</h1><p>{preview.record.author.name}</p><p>{preview.record.genre}</p>
      {preview.record.summary && <section className="space-y-4"><h2>Накратко</h2><StudyText text={preview.record.summary} /></section>}
      {[{ title: "Теми", items: preview.record.themes }, { title: "Герои", items: preview.record.characters }, { title: "Важни идеи", items: preview.record.importantIdeas }].filter((section) => section.items.length > 0).map((section) =>
        <section key={section.title} className="space-y-4"><h2>{section.title}</h2><LearningContent content={{ version: 1, blocks: [{ type: "list", ordered: false, items: section.items.map((text) => [{ type: "text", text }]) }] }} /></section>)}
      {preview.record.interpretation && <section className="space-y-4"><h2>Насоки за прочит</h2><StudyText text={preview.record.interpretation} /></section>}
    </>}
  </article>;
}
