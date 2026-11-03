import { useCallback, useState } from "react";

import type { Question } from "./types";

/**
 * Answers a student has given but not finished with, kept by question id. The value is the chosen
 * option id for a multiple-choice question and the typed text for a written one, and an empty
 * string means no answer yet. Holding every answer in one place above the question is what lets a
 * student move around the exam or practice session and find each answer exactly as they left it.
 */
export type AnswerDrafts = Readonly<Record<string, string>>;

/** Whether a question counts as answered: an option is chosen, or the text has a visible character. */
export function isAnswered(question: Pick<Question, "type">, draft: string | undefined): boolean {
  if (draft === undefined) {
    return false;
  }

  return question.type === "multiple-choice" ? draft !== "" : /\S/.test(draft);
}

/** The chosen option of a multiple-choice draft, or `null` when none is chosen. */
export function choiceFromDraft(draft: string | undefined): string | null {
  return draft === undefined || draft === "" ? null : draft;
}

/** What the navigator needs to know about each question: its id and whether it has an answer. */
export function toNavigatorItems(questions: readonly Question[], drafts: AnswerDrafts) {
  return questions.map((question) => ({ id: question.id, answered: isAnswered(question, drafts[question.id]) }));
}

/**
 * Keeps the drafts of a whole session. Pass `draft` for a question to its answer control and
 * `setDraft` to its change handler.
 */
export function useAnswerDrafts() {
  const [drafts, setDrafts] = useState<AnswerDrafts>({});

  const setDraft = useCallback((questionId: string, value: string) => {
    setDrafts((current) => ({ ...current, [questionId]: value }));
  }, []);

  return { drafts, setDraft };
}
