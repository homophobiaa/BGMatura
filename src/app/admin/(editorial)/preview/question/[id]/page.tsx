import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Feedback } from "@/components/ui/feedback";
import { QuestionPreview, type QuestionPreviewData } from "@/features/admin/components/question-preview";
import { editorialEditPath, publicationStatusLabels } from "@/features/admin/learning-kind-labels";
import { requireAdminPage } from "@/features/admin/server/page-authorization";
import { readQuestionForEditor } from "@/features/admin/server/question-editing";
import type { Question } from "@/features/questions/types";

export const metadata: Metadata = { title: "Преглед на въпрос — BG Matura", robots: { index: false, follow: false } };

type SavedQuestion = NonNullable<Awaited<ReturnType<typeof readQuestionForEditor>>>;

function presentation(question: SavedQuestion): Question {
  switch (question.type) {
    case "MULTIPLE_CHOICE": return { id: question.id, type: "multiple-choice", prompt: question.prompt, options: question.options.map(({ id, text }) => ({ id, text })) };
    case "SHORT_RESPONSE": return { id: question.id, type: "short-response", prompt: question.prompt };
    case "EXTENDED_RESPONSE": return { id: question.id, type: "extended-response", prompt: question.prompt };
    case "ARGUMENTATIVE_WRITING": return { id: question.id, type: "argumentative-writing", prompt: question.prompt };
  }
}

const rubricSchema = z.array(z.object({ id: z.string(), description: z.string(), indicativePoints: z.number().optional() }));

export default async function QuestionPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { requestHeaders } = await requireAdminPage();
  const question = await readQuestionForEditor(id, requestHeaders);
  if (!question) notFound();
  const rubric = rubricSchema.safeParse(question.rubric);
  const data: QuestionPreviewData = {
    question: presentation(question),
    assessmentMode: question.assessmentMode,
    maximumPoints: question.maximumPoints?.toNumber() ?? null,
    correctOptionId: question.correctOptionId,
    acceptedAnswers: question.acceptedAnswers,
    explanation: question.explanation ?? "",
    referenceGuidance: question.referenceGuidance ?? "",
    rubric: (rubric.success ? rubric.data : []).map(({ id: criterionId, description, indicativePoints }) =>
      indicativePoints === undefined ? { id: criterionId, description } : { id: criterionId, description, indicativePoints }),
  };
  return <article className="max-w-reading space-y-6">
    <Breadcrumbs items={[{ label: "Въпроси", href: "/admin/questions" }, { label: "Редакция", href: editorialEditPath("question", id) }, { label: "Преглед" }]} />
    <h1>Преглед на въпрос</h1>
    <Feedback tone="warning">Редакторски преглед · {publicationStatusLabels[question.status]}. Това не е публична страница.</Feedback>
    <QuestionPreview data={data} />
  </article>;
}
