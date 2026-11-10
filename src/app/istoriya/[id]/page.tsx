import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getSignedInUser } from "@/features/admin/server/authorization";
import { hasAdminConfiguration } from "@/features/admin/server/environment";
import { AttemptError } from "@/features/attempts/server/errors";
import { readAttempt } from "@/features/attempts/server/session";

export const metadata: Metadata = { title: "Резултат — BG Matura", robots: { index: false, follow: false } };

const dateFormat = new Intl.DateTimeFormat("bg-BG", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Sofia" });

type Attempt = Awaited<ReturnType<typeof readAttempt>>;
type Question = Attempt["questions"][number];

/** Words and a symbol, never colour alone. */
function outcome(question: Question) {
  if (question.answer === null) return "✗ Без отговор";
  const evaluation = "evaluation" in question ? question.evaluation : undefined;
  if (!evaluation) return "Отговорът е записан";
  if (evaluation.status === "self-review") return "✎ За самооценка";
  if (evaluation.status === "ungraded") return "Без автоматична оценка";
  return "correct" in question && question.correct ? "✓ Вярно" : "✗ Грешно";
}

function answerText(question: Question) {
  const { answer } = question;
  if (answer === null) return null;
  if (answer.type === "multiple-choice") {
    const options = question.question.type === "multiple-choice" ? question.question.options : [];
    return options.find(({ id }) => id === answer.selectedOptionId)?.text ?? null;
  }
  return answer.text;
}

export default async function HistoryEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = hasAdminConfiguration() ? await getSignedInUser(new Headers(await headers())).catch(() => null) : null;
  if (user === null) redirect(`/vhod?next=/istoriya/${encodeURIComponent(id)}`);

  let attempt: Attempt;
  try {
    attempt = await readAttempt({ id, userId: user.id });
  } catch (error) {
    if (error instanceof AttemptError) notFound();
    throw error;
  }
  const { result } = attempt;

  return (
    <article className="max-w-reading space-y-8">
      <header className="space-y-3">
        <p className="text-caption text-muted">{attempt.mode === "EXAM" ? "Пробна матура" : "Упражнение"}{attempt.completedAt ? <> · {dateFormat.format(attempt.completedAt)}</> : null}</p>
        <h1>{attempt.title}</h1>
        {attempt.state === "ACTIVE" ? <p>Този опит още не е приключен.</p> : null}
      </header>

      {result ? (
        <section aria-labelledby="summary" className="space-y-2 rounded-lg bg-surface-card p-4 md:p-6">
          <h2 id="summary" className="text-title">Обобщение</h2>
          <p>Отговорени: {result.answered} от {attempt.questions.length}</p>
          {result.objectiveMaximumPoints > 0 ? <p>Точки от автоматично оценяваните въпроси: {result.earnedPoints} от {result.objectiveMaximumPoints}</p> : null}
          {result.selfReview > 0 ? <p>Писмени задачи за самооценка: {result.selfReview}. Нямаме официална оценка за тях и не ги добавяме към точките.</p> : null}
        </section>
      ) : null}

      <ol className="space-y-6">
        {attempt.questions.map((question, index) => {
          const text = answerText(question);
          const feedback = "feedback" in question ? question.feedback : undefined;
          return (
            <li key={question.question.id} className="space-y-2 rounded-lg border border-hairline p-4">
              <p className="text-caption text-muted">Въпрос {index + 1} · {outcome(question)}</p>
              <p className="font-semibold">{question.question.prompt}</p>
              <p><span className="text-muted">Твоят отговор: </span>{text ?? "—"}</p>
              {feedback && "explanation" in feedback && feedback.explanation ? <p><span className="text-muted">Обяснение: </span>{feedback.explanation}</p> : null}
              {feedback && "referenceGuidance" in feedback && feedback.referenceGuidance ? <p><span className="text-muted">Насоки за самооценка: </span>{feedback.referenceGuidance}</p> : null}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap gap-3 border-t border-hairline pt-6">
        <Button asChild><Link href="/testove">Започни ново упражнение</Link></Button>
        <Button asChild variant="secondary"><Link href="/uchi">Към уроците</Link></Button>
        <Button asChild variant="secondary"><Link href="/istoriya">Назад към историята</Link></Button>
      </div>
    </article>
  );
}
