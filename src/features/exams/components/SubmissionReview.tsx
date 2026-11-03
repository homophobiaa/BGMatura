"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";

/** Where the submission stands. The page owns it, because the page talks to the server. */
export type SubmissionStatus =
  | { readonly phase: "reviewing" }
  | { readonly phase: "submitting" }
  /** The submission did not go through. The answers are kept, and trying again is safe. */
  | { readonly phase: "failed"; readonly message: string }
  /** The attempt is submitted. Shown again on return or refresh, without asking to submit again. */
  | { readonly phase: "submitted"; readonly resultHref: string };

export interface SubmissionReviewProps {
  /** How many questions the attempt has. */
  readonly total: number;
  /** Zero-based indexes of the questions without an answer, in order. */
  readonly unansweredIndexes: readonly number[];
  readonly status: SubmissionStatus;
  /**
   * Called once when the student confirms. The page should first make sure pending answers are saved,
   * then send the submission, which the server treats as safe to repeat, and then update `status`.
   */
  readonly onConfirm: () => void;
  /** Lets the student go back to a question from the list of unanswered ones. */
  readonly onGoToQuestion: (index: number) => void;
}

/**
 * The last screen of an exam: the counts of answered and unanswered questions, a plain statement that
 * submitting is final, and an explicit second step to confirm. It shows a submitting state, never
 * sends the same request twice, and on a failure keeps the answers and offers to try again. When the
 * attempt is already submitted it shows the way to the result instead of the submit button.
 */
export function SubmissionReview({ total, unansweredIndexes, status, onConfirm, onGoToQuestion }: SubmissionReviewProps) {
  const [confirming, setConfirming] = useState(false);
  // Blocks a second request in the moment between a click and the page updating `status`. It is
  // released once the submission has failed or the page is back to reviewing, so a retry works.
  const requestSent = useRef(false);

  useEffect(() => {
    if (status.phase !== "submitting") {
      requestSent.current = false;
    }
  }, [status.phase]);

  const answered = total - unansweredIndexes.length;
  const submitting = status.phase === "submitting";

  const confirm = () => {
    if (requestSent.current) {
      return;
    }

    requestSent.current = true;
    onConfirm();
  };

  if (status.phase === "submitted") {
    return (
      <section aria-labelledby="submission-heading" className="flex flex-col gap-4">
        <h2 id="submission-heading" className="text-display-md">
          Матурата е предадена
        </h2>
        <Feedback tone="success">Отговорите ти са предадени и не могат да се променят.</Feedback>
        <Button asChild className="w-fit">
          <a href={status.resultHref}>Виж резултата</a>
        </Button>
      </section>
    );
  }

  return (
    <section aria-labelledby="submission-heading" className="flex flex-col gap-6">
      <h2 id="submission-heading" className="text-display-md">
        Преглед преди предаване
      </h2>

      <dl className="grid max-w-md grid-cols-2 gap-4">
        <div className="rounded-lg bg-surface-card p-4">
          <dt className="text-caption text-muted">Отговорени</dt>
          <dd className="text-display-md text-ink">
            {answered} <span className="text-caption text-muted">от {total}</span>
          </dd>
        </div>
        <div className="rounded-lg bg-surface-card p-4">
          <dt className="text-caption text-muted">Без отговор</dt>
          <dd className="text-display-md text-ink">
            {unansweredIndexes.length} <span className="text-caption text-muted">от {total}</span>
          </dd>
        </div>
      </dl>

      {unansweredIndexes.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="max-w-reading text-body">Тези въпроси още нямат отговор. Можеш да се върнеш към всеки от тях.</p>
          <ul className="flex flex-wrap gap-2">
            {unansweredIndexes.map((index) => (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => onGoToQuestion(index)}
                  disabled={submitting}
                  aria-label={`Върни се към въпрос ${index + 1}`}
                  className="inline-flex size-11 items-center justify-center rounded-md border border-border-control bg-canvas text-label tabular-nums text-ink hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {index + 1}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="max-w-reading text-body">Отговори си на всички въпроси.</p>
      )}

      <div className="flex max-w-reading flex-col gap-2 rounded-lg bg-surface-soft p-4">
        <p className="text-label text-ink">Предаването е окончателно</p>
        <p className="text-body">
          След като предадеш матурата, не можеш да променяш отговорите си. Отговорите с писмен текст не получават
          автоматична оценка — ще ги прецениш сам с насоките.
        </p>
      </div>

      {status.phase === "failed" ? <Feedback tone="error">{status.message} Отговорите ти са запазени и можеш да опиташ отново.</Feedback> : null}

      {submitting ? (
        <p role="status" className="flex items-center gap-2 text-body">
          <LoaderCircle aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" />
          Предаваме отговорите ти…
        </p>
      ) : null}

      {confirming || status.phase !== "reviewing" ? (
        <div role="group" aria-labelledby="confirm-heading" className="flex flex-col gap-4 rounded-lg border border-border-control p-4">
          <p
            id="confirm-heading"
            tabIndex={-1}
            ref={(element) => element?.focus()}
            className="max-w-reading text-title text-ink outline-none"
          >
            Сигурен ли си, че искаш да предадеш матурата?
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={confirm} disabled={submitting} aria-busy={submitting}>
              {submitting ? "Предаване…" : status.phase === "failed" ? "Опитай отново" : "Да, предай матурата"}
            </Button>
            <Button variant="secondary" disabled={submitting} onClick={() => setConfirming(false)}>
              Назад към въпросите
            </Button>
          </div>
        </div>
      ) : (
        <Button className="w-fit" onClick={() => setConfirming(true)}>
          Предай матурата
        </Button>
      )}
    </section>
  );
}
