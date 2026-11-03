"use client";

import { useEffect, useId, useRef } from "react";

import { WRITTEN_ANSWER_MAX_LENGTH } from "../answer-limits";
import type {
  ArgumentativeWritingQuestion,
  ExtendedResponseQuestion,
  ShortResponseQuestion,
} from "../types";
import { CircleXIcon } from "./feedback-icons";

export type WrittenQuestion = ShortResponseQuestion | ExtendedResponseQuestion | ArgumentativeWritingQuestion;

export interface WrittenAnswerProps {
  /** The public question: id, type, and prompt only. */
  readonly question: WrittenQuestion;
  /** The text exactly as typed, owned by the parent so it survives moving between questions. */
  readonly value: string;
  readonly onChange: (value: string) => void;
  /**
   * What is wrong with the answer, for example after an empty or too long submission. It is
   * announced to assistive technology, linked to the field, and the field takes focus.
   */
  readonly error?: string;
  /** Locks the field, for example while an answer is being sent. */
  readonly disabled?: boolean;
}

/**
 * Extended and argumentative answers are not scored by the system, and the student is told so
 * before writing. The public question does not say whether such a question is self-review or
 * ungraded, so the wording is true of both.
 */
const SELF_REVIEW_NOTE =
  "Този отговор не получава автоматична оценка. След като го изпратиш, ще видиш насоки, с които сам да прецениш написаното.";

const textareaRows = {
  "extended-response": 6,
  "argumentative-writing": 14,
} as const;

function signs(count: number): string {
  return count === 1 ? "1 знак" : `${count} знака`;
}

const fieldBase =
  "block w-full rounded-md border bg-canvas px-3 text-body text-ink placeholder:text-muted " +
  "disabled:cursor-default disabled:bg-surface-soft";

/**
 * A labelled field for a written answer: one line for a short response, a larger textarea for an
 * extended response or an argumentative text. The prompt is the label, and the text is never
 * trimmed or reformatted, so line breaks and Bulgarian letters are kept exactly as typed.
 */
export function WrittenAnswer({ question, value, onChange, error, disabled = false }: WrittenAnswerProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const maxLength = WRITTEN_ANSWER_MAX_LENGTH[question.type];
  const isShort = question.type === "short-response";
  const remaining = maxLength - value.length;
  const nearLimit = !isShort && remaining <= Math.ceil(maxLength / 10);

  // Moving focus to the field is how a form tells a keyboard or screen reader user where the problem is.
  useEffect(() => {
    if (error) {
      (inputRef.current ?? textareaRef.current)?.focus();
    }
  }, [error]);

  const noteId = `${id}-note`;
  const counterId = `${id}-counter`;
  const errorId = `${id}-error`;
  const describedBy = [
    isShort ? null : noteId,
    isShort ? null : counterId,
    error ? errorId : null,
  ]
    .filter((part) => part !== null)
    .join(" ");

  const fieldProps = {
    id,
    lang: "bg",
    value,
    maxLength,
    disabled,
    spellCheck: true,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy === "" ? undefined : describedBy,
    className: `${fieldBase} ${error ? "border-error" : "border-border-control"}`,
  } as const;

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={id} className="max-w-reading font-serif text-body-lg text-ink">
        {question.prompt}
      </label>

      {isShort ? null : (
        <p id={noteId} className="max-w-reading text-caption text-muted">
          {SELF_REVIEW_NOTE}
        </p>
      )}

      {question.type === "short-response" ? (
        <input
          {...fieldProps}
          ref={inputRef}
          type="text"
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
          className={`${fieldProps.className} h-11`}
        />
      ) : (
        <textarea
          {...fieldProps}
          ref={textareaRef}
          rows={textareaRows[question.type]}
          onChange={(event) => onChange(event.target.value)}
          className={`${fieldProps.className} resize-y py-3`}
        />
      )}

      {isShort ? null : (
        <>
          <p id={counterId} className="text-caption text-muted">
            {value.length} от {maxLength} знака
          </p>
          <p role="status" className="sr-only">
            {nearLimit
              ? remaining > 0
                ? `Остават ${signs(remaining)}.`
                : `Достигнат е лимитът от ${maxLength} знака.`
              : ""}
          </p>
        </>
      )}

      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-2 text-label text-error">
          <CircleXIcon className="mt-px size-5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
