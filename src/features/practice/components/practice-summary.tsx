"use client";

import Link from "next/link";
import { formatPoints, type AttemptView } from "../attempt-view";
import { AnsweredQuestion, OutcomeLine } from "./question-feedback";
import { StartPracticeButton } from "./start-practice-button";

/**
 * The finished practice session. Points cover only automatically scored questions;
 * written and ungraded answers are counted separately and never get a number.
 */
export function PracticeSummary({ view, topicId, lessons }: { view: AttemptView; topicId: string; lessons: { title: string; slug: string }[] }) {
  const result = view.result;
  return <div className="space-y-8">
    <header className="space-y-2">
      <p className="text-label text-primary">Упражнението е завършено</p>
      <h1 className="[overflow-wrap:anywhere]">{view.title}</h1>
    </header>

    {result && <section aria-labelledby="summary-heading" className="space-y-4 rounded-lg bg-surface-card p-4 md:p-6">
      <h2 id="summary-heading" className="text-title">Резултат</h2>
      {result.objectiveMaximumPoints > 0
        ? <p className="text-body-lg">Точки от автоматично оценените въпроси: <strong>{formatPoints(result.earnedPoints)} от {formatPoints(result.objectiveMaximumPoints)}</strong></p>
        : <p>В това упражнение няма автоматично оценени въпроси.</p>}
      <dl className="grid gap-2 sm:grid-cols-2">
        <SummaryCount label="Верни" value={result.correct} />
        <SummaryCount label="Грешни" value={result.incorrect} />
        <SummaryCount label="За самооценка" value={result.selfReview} />
        <SummaryCount label="Без автоматична оценка" value={result.ungraded} />
        <SummaryCount label="Без отговор" value={result.unanswered} />
      </dl>
      {(result.selfReview > 0 || result.ungraded > 0) && <p className="text-caption text-muted">Писмените отговори не получават точки от системата. Сравни ги с насоките по-долу.</p>}
      {result.unanswered > 0 && <p className="text-caption text-muted">Въпросите без отговор се броят в максимума на точките.</p>}
    </section>}

    <section aria-labelledby="next-heading" className="space-y-4">
      <h2 id="next-heading" className="text-title">Какво следва</h2>
      {lessons.length > 0 && <div className="space-y-2">
        <p>Прочети уроците по темата:</p>
        <ul className="space-y-1">{lessons.map((lesson) => <li key={lesson.slug}>
          <Link href={`/balgarski-ezik/${encodeURIComponent(lesson.slug)}`} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">{lesson.title}</Link>
        </li>)}</ul>
      </div>}
      <div className="flex flex-wrap items-start gap-3">
        <StartPracticeButton topicId={topicId} label="Ново упражнение по темата" />
        <Link href="/testove" className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Към всички теми</Link>
      </div>
      <p className="text-caption text-muted">Новото упражнение е отделен опит. Този резултат остава достъпен на това устройство чрез адреса на страницата.</p>
    </section>

    <section aria-labelledby="review-heading" className="space-y-4">
      <h2 id="review-heading" className="text-title">Преглед на въпросите</h2>
      <ol className="space-y-4">
        {view.questions.map((item, index) => <li key={item.question.id} className="space-y-3 rounded-lg border border-hairline p-4">
          <p className="text-label">Въпрос {index + 1}</p>
          {item.answer
            ? <AnsweredQuestion item={item} />
            : <><p className="max-w-reading font-serif text-body-lg text-ink">{item.question.prompt}</p><OutcomeLine item={item} /></>}
        </li>)}
      </ol>
    </section>
  </div>;
}

function SummaryCount({ label, value }: { label: string; value: number }) {
  return <div className="flex justify-between gap-4 rounded-md bg-surface-soft px-3 py-2"><dt>{label}</dt><dd className="tabular-nums text-label">{value}</dd></div>;
}
