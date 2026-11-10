"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MultipleChoiceAnswer } from "@/features/questions/components/MultipleChoiceAnswer";
import { WrittenAnswer } from "@/features/questions/components/WrittenAnswer";
import { WrittenSelfReview, type SelfReviewCriterion } from "@/features/questions/components/WrittenSelfReview";
import type { Question } from "@/features/questions/types";

/** Everything a protected preview shows, including the key. Built on the server for admins only. */
export type QuestionPreviewData = {
  question: Question;
  assessmentMode: "OBJECTIVE" | "SELF_REVIEW" | "UNGRADED";
  maximumPoints: number | null;
  correctOptionId: string | null;
  acceptedAnswers: string[];
  explanation: string;
  referenceGuidance: string;
  rubric: SelfReviewCriterion[];
};

/**
 * Lets an editor try the question with the student controls, then reveal the same
 * feedback a student would see. Nothing is saved or graded here.
 */
export function QuestionPreview({ data }: { data: QuestionPreviewData }) {
  const [draft, setDraft] = useState("");
  const [revealed, setRevealed] = useState(false);
  const { question } = data;
  const objective = data.assessmentMode === "OBJECTIVE";

  return <div className="space-y-8">
    <section aria-labelledby="student-view" className="space-y-4 rounded-lg bg-surface-card p-4 md:p-6">
      <h2 id="student-view" className="text-title">Както го вижда ученикът</h2>
      {!revealed && <>
        {question.type === "multiple-choice"
          ? <MultipleChoiceAnswer question={question} selectedOptionId={draft || null} onSelect={setDraft} />
          : <WrittenAnswer question={question} value={draft} onChange={setDraft} />}
        <Button type="button" onClick={() => setRevealed(true)}>Покажи обратната връзка</Button>
      </>}
      {revealed && <>
        {question.type === "multiple-choice" && data.correctOptionId
          ? <MultipleChoiceAnswer question={question} selectedOptionId={draft || null} onSelect={() => undefined} feedback={{ correctOptionId: data.correctOptionId }} />
          : null}
        {!objective && <WrittenSelfReview prompt={question.prompt} submittedText={draft} status={data.assessmentMode === "UNGRADED" ? "ungraded" : "self-review"}
          referenceGuidance={data.referenceGuidance || "Насоките още не са попълнени."} rubric={data.rubric} />}
        {objective && question.type !== "multiple-choice" && <p className="max-w-reading font-serif text-body-lg">{question.prompt}</p>}
        {objective && <div className="space-y-2 rounded-lg bg-surface-soft p-4">
          <p className="text-label">Обяснение</p>
          <p className="whitespace-pre-wrap">{data.explanation || "Обяснението още не е попълнено."}</p>
        </div>}
        <Button type="button" variant="secondary" onClick={() => { setRevealed(false); setDraft(""); }}>Опитай отново</Button>
      </>}
    </section>

    <section aria-labelledby="answer-key" className="space-y-3 rounded-lg border border-hairline p-4 md:p-6">
      <h2 id="answer-key" className="text-title">Ключ (вижда се само тук)</h2>
      {objective && <p>Точки: {data.maximumPoints === null ? "не са зададени" : data.maximumPoints.toLocaleString("bg-BG")}</p>}
      {question.type === "multiple-choice" && <p>Верен отговор: {question.options.find((option) => option.id === data.correctOptionId)?.text ?? "не е отбелязан"}</p>}
      {question.type === "short-response" && objective && <p>Приемливи отговори: {data.acceptedAnswers.length ? data.acceptedAnswers.join("; ") : "няма"}</p>}
      {!objective && <p>Писмен отговор без автоматична оценка ({data.assessmentMode === "UNGRADED" ? "без оценка" : "самооценка"}).</p>}
    </section>
  </div>;
}
