"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import type { HistoryItem } from "@/features/attempts/history-item";

const dateFormat = new Intl.DateTimeFormat("bg-BG", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Sofia" });
const modeLabel = { PRACTICE: "Упражнение", EXAM: "Пробна матура" } as const;

function Entry({ item }: { item: HistoryItem }) {
  return (
    <li className="rounded-lg border border-hairline p-4">
      <p className="text-caption text-muted">{modeLabel[item.mode]} · <time dateTime={item.completedAt}>{dateFormat.format(new Date(item.completedAt))}</time></p>
      <h2 className="mt-1 text-title">
        <Link href={`/istoriya/${item.id}`} className="underline-offset-4 hover:underline">{item.title}</Link>
      </h2>
      <p className="mt-2">Отговорени: {item.answered} от {item.totalQuestions}</p>
      {item.points ? <p>Точки от автоматично оценяваните въпроси: {item.points.earned} от {item.points.maximum}</p> : null}
      {item.selfReview > 0 ? <p>Писмени задачи за самооценка: {item.selfReview}. Те не се добавят към точките.</p> : null}
    </li>
  );
}

/** The first page comes from the server; "Покажи още" asks for the next one. Failures keep what is already shown. */
export function HistoryList({ initialItems, initialCursor }: { initialItems: HistoryItem[]; initialCursor: string | null }) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function more() {
    if (!cursor) return;
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/account/attempts?cursor=${encodeURIComponent(cursor)}`, { credentials: "same-origin" });
      if (!response.ok) throw new Error("failed");
      const page = (await response.json()) as { items: HistoryItem[]; nextCursor: string | null };
      setItems((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (items.length === 0) {
    return (
      <section aria-labelledby="empty" className="space-y-4">
        <h2 id="empty" className="text-title">Още няма запазени резултати</h2>
        <p>Когато завършиш упражнение или пробна матура, докато си влязъл, резултатът се появява тук.</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild><Link href="/testove">Започни упражнение</Link></Button>
          <Button asChild variant="secondary"><Link href="/uchi">Към уроците</Link></Button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <ul className="space-y-4">{items.map((item) => <Entry key={item.id} item={item} />)}</ul>
      {failed ? <Feedback tone="error">Не успяхме да заредим още резултати. Опитай отново.</Feedback> : null}
      {cursor ? <Button type="button" variant="secondary" busy={busy} onClick={() => { void more(); }}>Покажи още</Button> : null}
      <div className="flex flex-wrap gap-3 border-t border-hairline pt-6">
        <Button asChild><Link href="/testove">Започни ново упражнение</Link></Button>
        <Button asChild variant="secondary"><Link href="/uchi">Към уроците</Link></Button>
      </div>
    </div>
  );
}
