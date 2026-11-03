import type { QuestionType } from "./types";

/**
 * Longest written answer accepted for each question type, in characters. The browser uses
 * these as `maxLength`, and the server must validate against the same numbers when it
 * receives an answer, because a browser limit alone can be bypassed.
 *
 * These are editorial defaults sized for the 2026 exam format (see EXAM_BLUEPRINT.md): a short
 * answer can be a rewritten sentence or a short text, an extended response is a few
 * sentences, and the argumentative text may run to about four pages. Revisit them when the
 * 2027 specification is confirmed.
 */
export const WRITTEN_ANSWER_MAX_LENGTH = {
  "short-response": 500,
  "extended-response": 3000,
  "argumentative-writing": 10000,
} as const satisfies Record<Exclude<QuestionType, "multiple-choice">, number>;

export type WrittenAnswerType = keyof typeof WRITTEN_ANSWER_MAX_LENGTH;

export type WrittenAnswerProblem = "empty" | "too-long";

/**
 * Finds what is wrong with a written answer before it is sent, or returns `null`. Text is
 * never trimmed or changed: an answer made only of spaces or line breaks counts as empty,
 * and length is counted exactly as typed, matching the browser's `maxLength`.
 *
 * Whether an empty answer is allowed depends on the page: practice asks the student to
 * write something, while an exam may be submitted with unanswered questions.
 */
export function findWrittenAnswerProblem(type: WrittenAnswerType, text: string): WrittenAnswerProblem | null {
  if (!/\S/.test(text)) {
    return "empty";
  }

  return text.length > WRITTEN_ANSWER_MAX_LENGTH[type] ? "too-long" : null;
}
