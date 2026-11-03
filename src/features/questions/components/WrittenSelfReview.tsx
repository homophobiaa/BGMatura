import { Clock } from "lucide-react";

/**
 * One criterion of the editor's rubric. It has the same shape as the server's rubric criterion, so the
 * rubric captured with an attempt can be passed in as it is.
 */
export interface SelfReviewCriterion {
  readonly id: string;
  readonly description: string;
  /** What the criterion is worth in the official rubric. It is a guide for self-assessment, never a score. */
  readonly indicativePoints?: number;
}

export interface WrittenSelfReviewProps {
  readonly prompt: string;
  /** The student's text exactly as submitted. It may be empty. */
  readonly submittedText: string;
  /**
   * How the written answer was handled. Either way it carries no machine-assigned points: a
   * self-review question asks the student to compare their text with the guidance, and an ungraded
   * one is simply recorded.
   */
  readonly status: "self-review" | "ungraded";
  /** The guidance captured with the attempt, shown only after the student has submitted. */
  readonly referenceGuidance: string;
  readonly rubric: readonly SelfReviewCriterion[];
}

const STATUS = {
  "self-review": {
    label: "За самооценка",
    explanation:
      "Този отговор няма автоматична оценка и системата не му дава точки. Сравни написаното с насоките и сам прецени как си се справил.",
  },
  ungraded: {
    label: "Без автоматична оценка",
    explanation:
      "Този отговор не се оценява автоматично и системата не му дава точки. Насоките са за сравнение, ако искаш да прецениш написаното.",
  },
} as const;

function points(value: number): string {
  return value === 1 ? "1 точка" : `${value.toLocaleString("bg-BG")} точки`;
}

const sectionHeading = "font-sans text-title text-ink";

/**
 * A written answer shown for self-review after submission: what the student wrote, next to the
 * guidance and rubric captured with the attempt. It never shows an earned score, a maximum, or a
 * percentage, and nothing here is machine graded. Rubric points, when given, are labelled as a guide.
 *
 * The student's text keeps its line breaks and wraps long words, so long Bulgarian text stays
 * readable at any width.
 */
export function WrittenSelfReview({ prompt, submittedText, status, referenceGuidance, rubric }: WrittenSelfReviewProps) {
  const { label, explanation } = STATUS[status];
  const hasText = /\S/.test(submittedText);
  const showsIndicativePoints = rubric.some((criterion) => criterion.indicativePoints !== undefined);

  return (
    <article aria-label="Преглед на писмен отговор" className="flex flex-col gap-6">
      <p className="max-w-reading font-serif text-body-lg text-ink">{prompt}</p>

      <div className="flex flex-col gap-2 rounded-lg bg-surface-soft p-4">
        <p className="flex items-center gap-2 text-label text-pending">
          <Clock aria-hidden="true" className="size-5 shrink-0" />
          {label}
        </p>
        <p className="max-w-reading text-body">{explanation}</p>
      </div>

      <section aria-labelledby="self-review-answer" className="flex flex-col gap-2">
        <h3 id="self-review-answer" className={sectionHeading}>
          Твоят отговор
        </h3>
        {hasText ? (
          <p className="max-w-reading whitespace-pre-wrap text-body-lg text-ink [overflow-wrap:anywhere]">
            {submittedText}
          </p>
        ) : (
          <p className="text-body text-muted">Не си написал отговор.</p>
        )}
      </section>

      <section aria-labelledby="self-review-guidance" className="flex flex-col gap-2 rounded-lg bg-surface-card p-4 md:p-6">
        <h3 id="self-review-guidance" className={sectionHeading}>
          Насоки за самооценка
        </h3>
        <p className="max-w-reading whitespace-pre-line text-body text-ink [overflow-wrap:anywhere]">
          {referenceGuidance}
        </p>
      </section>

      {rubric.length > 0 ? (
        <section aria-labelledby="self-review-rubric" className="flex flex-col gap-3">
          <h3 id="self-review-rubric" className={sectionHeading}>
            Критерии
          </h3>
          <ul className="flex max-w-reading flex-col gap-2">
            {rubric.map((criterion) => (
              <li key={criterion.id} className="flex flex-col gap-1 rounded-md border border-border-control p-3">
                <span className="text-body text-ink [overflow-wrap:anywhere]">{criterion.description}</span>
                {criterion.indicativePoints !== undefined ? (
                  <span className="text-caption text-muted">Ориентировъчно: до {points(criterion.indicativePoints)}</span>
                ) : null}
              </li>
            ))}
          </ul>
          {showsIndicativePoints ? (
            <p className="max-w-reading text-caption text-muted">
              Точките са ориентировъчни, за да сравниш себе си. Те не се добавят към резултата ти.
            </p>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}
