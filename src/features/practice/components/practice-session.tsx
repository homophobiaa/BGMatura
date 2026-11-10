"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { choiceFromDraft, isAnswered, useAnswerDrafts } from "@/features/questions/answer-drafts";
import { MultipleChoiceAnswer } from "@/features/questions/components/MultipleChoiceAnswer";
import { QuestionNavigator } from "@/features/questions/components/QuestionNavigator";
import { WrittenAnswer } from "@/features/questions/components/WrittenAnswer";
import type { SubmittedAnswer } from "@/features/questions/types";
import type { AttemptQuestionView, AttemptView } from "../attempt-view";
import { finishPracticeAttempt, readPracticeAttempt, savePracticePosition, submitPracticeAnswer } from "./practice-api";
import { PracticeSummary } from "./practice-summary";
import { AnsweredQuestion } from "./question-feedback";
import { StartPracticeButton } from "./start-practice-button";

type Lesson = { title: string; slug: string };

/** Turns the student's draft into the answer the server expects. */
function toSubmittedAnswer(item: AttemptQuestionView, draft: string): SubmittedAnswer {
  const { question } = item;
  if (question.type === "multiple-choice") return { questionId: question.id, type: "multiple-choice", selectedOptionId: choiceFromDraft(draft) };
  return { questionId: question.id, type: question.type, text: draft };
}

/**
 * One anonymous practice session. The server owns every answer and grade: the page
 * loads the session, sends one answer at a time, and shows feedback only from the
 * server's reply. Unsent drafts stay in memory while the student moves between questions.
 */
export function PracticeSession({ attemptId, topicId, lessons }: { attemptId: string; topicId: string; lessons: Lesson[] }) {
  const [view, setView] = useState<AttemptView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmingFinish, setConfirmingFinish] = useState(false);
  const { drafts, setDraft } = useAnswerDrafts();
  const inFlight = useRef(false);
  const serverPosition = useRef(0);
  const questionHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let cancelled = false;
    void readPracticeAttempt(attemptId).then((result) => {
      if (cancelled) return;
      if (!result.ok) { setLoadError(result.message); return; }
      if (result.value.mode !== "PRACTICE") { setLoadError("Това не е упражнение."); return; }
      setView(result.value);
      setPosition(Math.min(result.value.position, Math.max(result.value.questions.length - 1, 0)));
      serverPosition.current = result.value.position;
    });
    return () => { cancelled = true; };
  }, [attemptId]);

  async function runOnce(operation: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setActionError(null);
    try { await operation(); }
    finally { inFlight.current = false; setBusy(false); }
  }

  if (loadError) {
    return <div className="max-w-reading space-y-6">
      <h1>Упражнението не е достъпно</h1>
      <Feedback tone="error">{loadError}</Feedback>
      <div className="flex flex-wrap items-start gap-3">
        <StartPracticeButton topicId={topicId} label="Започни ново упражнение" />
        <Link href="/testove" className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Към всички теми</Link>
      </div>
    </div>;
  }
  if (!view) return <Feedback>Зареждане на упражнението…</Feedback>;
  if (view.state !== "ACTIVE") return <PracticeSummary view={view} topicId={topicId} lessons={lessons} />;

  const current = view.questions[position];
  if (!current) return <Feedback tone="error">Упражнението няма въпроси.</Feedback>;
  const draft = drafts[current.question.id] ?? "";
  const answeredCount = view.questions.filter((item) => item.answer !== null).length;
  const unansweredCount = view.questions.length - answeredCount;
  const written = current.question.type !== "multiple-choice" && current.question.type !== "short-response";

  function navigate(index: number) {
    setPosition(index);
    setActionError(null);
    setConfirmingFinish(false);
    questionHeading.current?.focus();
    // Remembering the position is a convenience for refreshes; a failure must not block studying.
    const expected = serverPosition.current;
    void savePracticePosition(attemptId, index, expected).then((result) => { if (result.ok) serverPosition.current = result.value.position; });
  }

  function submitAnswer(item: AttemptQuestionView) {
    void runOnce(async () => {
      const result = await submitPracticeAnswer(attemptId, toSubmittedAnswer(item, drafts[item.question.id] ?? ""), item.revision);
      if (!result.ok) { setActionError(result.message); return; }
      const saved = result.value;
      setView((previous) => previous && {
        ...previous,
        questions: previous.questions.map((existing) => existing.question.id === saved.question.id ? saved : existing),
      });
    });
  }

  function finish() {
    void runOnce(async () => {
      const result = await finishPracticeAttempt(attemptId);
      if (!result.ok) { setActionError(result.message); return; }
      setView(result.value);
      window.scrollTo({ top: 0 });
    });
  }

  return <div className="space-y-8">
    <header className="space-y-2">
      <p className="text-label text-primary">Упражнение</p>
      <h1 className="[overflow-wrap:anywhere]">{view.title}</h1>
    </header>

    <QuestionNavigator items={view.questions.map((item) => ({ id: item.question.id, answered: item.answer !== null }))} currentIndex={position} onNavigate={navigate} />

    <section aria-labelledby="current-question" className="space-y-6 rounded-lg bg-surface-card p-4 md:p-6">
      <h2 id="current-question" ref={questionHeading} tabIndex={-1} className="text-title">Въпрос {position + 1}</h2>
      {current.answer
        ? <div aria-live="polite" className="space-y-4"><AnsweredQuestion item={current} /></div>
        : <div className="space-y-4">
          {current.question.type === "multiple-choice"
            ? <MultipleChoiceAnswer question={current.question} selectedOptionId={choiceFromDraft(draft)} disabled={busy}
              onSelect={(optionId) => setDraft(current.question.id, optionId)} />
            : <WrittenAnswer question={current.question} value={draft} disabled={busy} onChange={(value) => setDraft(current.question.id, value)} />}
          <Button type="button" busy={busy} disabled={!isAnswered(current.question, draft)} onClick={() => submitAnswer(current)}>
            {written ? "Изпрати отговора" : "Провери отговора"}
          </Button>
          <p className="text-caption text-muted">След като изпратиш отговора, той не може да се промени.</p>
        </div>}
      {actionError && <Feedback tone="error">{actionError}</Feedback>}
    </section>

    <section aria-labelledby="finish-heading" className="space-y-3">
      <h2 id="finish-heading" className="sr-only">Приключване</h2>
      {!confirmingFinish
        ? <Button type="button" variant="secondary" disabled={busy} onClick={() => unansweredCount > 0 ? setConfirmingFinish(true) : finish()}>Приключи упражнението</Button>
        : <div role="group" aria-label="Потвърди приключването" className="space-y-3 rounded-lg bg-surface-soft p-4">
          <p>{unansweredCount === 1 ? "Един въпрос е без отговор." : `${unansweredCount} въпроса са без отговор.`} Ще се отчетат като пропуснати. Да приключа ли?</p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" busy={busy} onClick={finish}>Да, приключи</Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => setConfirmingFinish(false)}>Продължи упражнението</Button>
          </div>
        </div>}
    </section>
  </div>;
}
