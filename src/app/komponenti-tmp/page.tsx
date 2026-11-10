"use client";

import { useState } from "react";

import { ExamCountdown } from "@/features/exams/components/ExamCountdown";
import { choiceFromDraft, toNavigatorItems, useAnswerDrafts } from "@/features/questions/answer-drafts";
import { MultipleChoiceAnswer } from "@/features/questions/components/MultipleChoiceAnswer";
import { QuestionNavigator } from "@/features/questions/components/QuestionNavigator";
import { WrittenAnswer } from "@/features/questions/components/WrittenAnswer";
import type { MultipleChoiceQuestion, Question } from "@/features/questions/types";

const choice: MultipleChoiceQuestion = {
  id: "demo-choice",
  type: "multiple-choice",
  prompt: "Кое тълкуване на цитирания израз от „Две души“ съответства на смисъла на творбата: „Аз сам не живея – горя!“?",
  options: [
    { id: "a", text: "Представя удовлетворението на лирическия аз от пълноценното му съществуване." },
    { id: "b", text: "Внушава ужаса на лирическия аз от досега му с външната действителност." },
    { id: "c", text: "Откроява душевния драматизъм на лирическия аз в неспокойното му битие." },
    { id: "d", text: "Разкрива вярата на лирическия аз в постигането на истинския смисъл на живота." },
  ],
};

const session: Question[] = [
  { ...choice, id: "s1", prompt: "Задача 1: Кой е авторът на „Под игото“?", options: [{ id: "a", text: "Иван Вазов" }, { id: "b", text: "Пейо Яворов" }, { id: "c", text: "Елин Пелин" }] },
  { id: "s2", type: "short-response", prompt: "Задача 2: Запишете САМО думата, в която е допусната правописна грешка: „Университетът предлага курсове за следипломна квалификация.“" },
  { id: "s3", type: "extended-response", prompt: "Задача 3: Обяснете накратко връзката между любовта и страха в „Посвещение“." },
  { ...choice, id: "s4", prompt: "Задача 4: Към кой жанр принадлежи „Градушка“?", options: [{ id: "a", text: "Разказ" }, { id: "b", text: "Стихотворение" }] },
  { id: "s5", type: "argumentative-writing", prompt: "Задача 5: Напишете аргументативен текст на тема „Авторитетите днес“ (есе)." },
];

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg bg-surface-soft p-4 md:p-6">
      <div>
        <h2 className="text-display-md">{title}</h2>
        <p className="mt-1 max-w-reading text-caption text-muted">{note}</p>
      </div>
      {children}
    </section>
  );
}

export default function ComponentGallery() {
  const [selected, setSelected] = useState<string | null>("b");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [index, setIndex] = useState(0);
  const { drafts, setDraft } = useAnswerDrafts();
  const [clock] = useState(() => {
    const now = Date.now();
    return { serverNow: new Date(now).toISOString(), deadline: new Date(now + (4 * 60 * 60 + 5) * 1000).toISOString(), soon: new Date(now + 4 * 60 * 1000 + 8000).toISOString() };
  });
  const current = session[index] as Question;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 md:py-12">
      <header>
        <p className="text-caption text-muted">Временна страница за преглед — не е част от проекта</p>
        <h1 className="mt-2 text-display-lg">Компоненти за отговаряне и пробна матура</h1>
        <p className="mt-3 max-w-reading text-body">Това са готовите компоненти (задачи #81, #82, #113, #114). Още не са вградени в истински страници, затова са събрани тук. Всичко е интерактивно.</p>
      </header>

      <Section title="Затворен отговор" note="Задача #81 — избор между варианти, с клавиатура и докосване.">
        <MultipleChoiceAnswer question={choice} selectedOptionId={selected} onSelect={setSelected} />
      </Section>

      <Section title="Обратна връзка след проверка" note="Показва се само след като сървърът потвърди отговора. Никога само с цвят.">
        <MultipleChoiceAnswer question={choice} selectedOptionId="b" onSelect={() => undefined} feedback={{ correctOptionId: "c" }} />
      </Section>

      <Section title="Свободен отговор" note="Задача #82 — един ред за кратък отговор, поле за разширен отговор и есе. Натисни „Провери“ с празно поле.">
        <WrittenAnswer question={session[1] as never} value="следдипломна" onChange={() => undefined} />
        <WrittenAnswer question={session[2] as never} value={text} onChange={(v) => { setText(v); setError(undefined); }} {...(error ? { error } : {})} />
        <button type="button" className="inline-flex h-11 w-fit items-center rounded-md bg-primary px-5 text-label text-on-primary hover:bg-primary-active" onClick={() => setError(/\S/.test(text) ? undefined : "Напиши отговор, преди да го изпратиш.")}>Провери</button>
      </Section>

      <Section title="Оставащо време" note="Задача #113 — броене от срока на сървъра. Втората линия е в последните 5 минути.">
        <ExamCountdown deadline={clock.deadline} serverNow={clock.serverNow} />
        <ExamCountdown deadline={clock.soon} serverNow={clock.serverNow} />
      </Section>

      <Section title="Навигация между въпросите" note="Задача #114 — отговорите се пазят, когато се местиш напред и назад.">
        <QuestionNavigator items={toNavigatorItems(session, drafts)} currentIndex={index} onNavigate={setIndex} />
        {current.type === "multiple-choice" ? (
          <MultipleChoiceAnswer key={current.id} question={current} selectedOptionId={choiceFromDraft(drafts[current.id])} onSelect={(id) => setDraft(current.id, id)} />
        ) : (
          <WrittenAnswer key={current.id} question={current} value={drafts[current.id] ?? ""} onChange={(v) => setDraft(current.id, v)} />
        )}
      </Section>
    </main>
  );
}
