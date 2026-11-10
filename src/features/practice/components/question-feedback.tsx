"use client";

import { Clock } from "lucide-react";
import { MultipleChoiceAnswer } from "@/features/questions/components/MultipleChoiceAnswer";
import { WrittenSelfReview } from "@/features/questions/components/WrittenSelfReview";
import { CircleCheckIcon, CircleXIcon } from "@/features/questions/components/feedback-icons";
import { formatPoints, isWrittenFeedback, outcomeLabels, questionOutcome, type AttemptQuestionView } from "../attempt-view";

/**
 * A question after the server accepted its answer: the locked answer, whether it was right
 * (only where the server graded it), the reference answer, and the explanation.
 * Written answers get self-review guidance and never a score.
 */
export function AnsweredQuestion({ item }: { item: AttemptQuestionView }) {
  const { question, answer, feedback, evaluation } = item;
  if (!answer || !feedback) return null;

  if (isWrittenFeedback(feedback)) {
    const status = evaluation?.status === "ungraded" ? "ungraded" : "self-review";
    return <WrittenSelfReview prompt={question.prompt} submittedText={"text" in answer ? answer.text : ""}
      status={status} referenceGuidance={feedback.referenceGuidance}
      rubric={feedback.rubric.map(({ id, description, indicativePoints }) => indicativePoints === undefined ? { id, description } : { id, description, indicativePoints })} />;
  }

  return <div className="space-y-4">
    {question.type === "multiple-choice" && answer.type === "multiple-choice"
      ? <MultipleChoiceAnswer question={question} selectedOptionId={answer.selectedOptionId} onSelect={() => undefined}
        {...(feedback.correctOptionId ? { feedback: { correctOptionId: feedback.correctOptionId } } : { disabled: true })} />
      : <div className="space-y-2">
        <p className="max-w-reading font-serif text-body-lg text-ink">{question.prompt}</p>
        <p className="text-caption text-muted">Твоят отговор</p>
        <p className="whitespace-pre-wrap rounded-md bg-surface-soft p-3 [overflow-wrap:anywhere]">{"text" in answer ? answer.text : ""}</p>
      </div>}
    <OutcomeLine item={item} />
    {feedback.acceptedAnswers && feedback.acceptedAnswers.length > 0 && <p>
      <span className="text-label">{feedback.acceptedAnswers.length === 1 ? "Верен отговор: " : "Приемливи отговори: "}</span>
      {feedback.acceptedAnswers.join("; ")}
    </p>}
    {feedback.explanation.trim() && <div className="space-y-2 rounded-lg bg-surface-soft p-4">
      <p className="text-label">Обяснение</p>
      <p className="whitespace-pre-wrap">{feedback.explanation}</p>
    </div>}
  </div>;
}

/** Text and icon, never color alone. Points are shown only for server-scored answers. */
export function OutcomeLine({ item }: { item: AttemptQuestionView }) {
  const outcome = questionOutcome(item);
  const label = outcomeLabels[outcome];
  const evaluation = item.evaluation;
  const points = evaluation?.status === "scored" ? ` · ${formatPoints(evaluation.earnedPoints)} от ${formatPoints(evaluation.maximumPoints)} т.` : "";
  if (outcome === "correct") return <p className="flex items-center gap-2 text-label text-success"><CircleCheckIcon />{label}{points}</p>;
  if (outcome === "incorrect") return <p className="flex items-center gap-2 text-label text-error"><CircleXIcon />{label}{points}</p>;
  return <p className="flex items-center gap-2 text-label text-muted"><Clock aria-hidden="true" className="size-5" />{label}</p>;
}
