"use client";

import { useId } from "react";

import type { MultipleChoiceQuestion, QuestionOption } from "../types";
import { CircleCheckIcon, CircleXIcon } from "./feedback-icons";

/**
 * Shown only after the server has confirmed the answer. It is passed in separately from the
 * question, so an answer key can never be part of the data used while a student is answering.
 */
export interface MultipleChoiceFeedback {
  readonly correctOptionId: string;
}

export interface MultipleChoiceAnswerProps {
  /** The public question: prompt and options, never a key. */
  readonly question: MultipleChoiceQuestion;
  /**
   * The chosen option, owned by the parent. Because the parent holds it, a choice survives
   * moving to another question and coming back, and a page refresh when the parent restores it.
   */
  readonly selectedOptionId: string | null;
  readonly onSelect: (optionId: string) => void;
  /** Present only once the answer is graded; the options are then locked and marked. */
  readonly feedback?: MultipleChoiceFeedback;
  /** Locks the options without marking them, for example while an answer is being sent. */
  readonly disabled?: boolean;
}

const rowBase =
  "flex min-h-12 w-full items-start gap-3 rounded-md border bg-canvas px-4 py-3 text-left";

const answeringRow =
  "cursor-pointer border-border-control has-[:checked]:border-primary has-[:checked]:bg-surface-strong " +
  "has-[:checked]:shadow-[inset_0_0_0_1px_var(--primary)] has-[:disabled]:cursor-default";

const feedbackRow = "cursor-default";

function optionStatus(
  option: QuestionOption,
  selectedOptionId: string | null,
  feedback: MultipleChoiceFeedback,
): "correct" | "incorrect" | "neutral" {
  if (option.id === feedback.correctOptionId) {
    return "correct";
  }

  return option.id === selectedOptionId ? "incorrect" : "neutral";
}

const feedbackRowByStatus = {
  correct: "border-success shadow-[inset_0_0_0_1px_var(--success)]",
  incorrect: "border-error shadow-[inset_0_0_0_1px_var(--error)]",
  neutral: "border-border-control",
} as const;

/**
 * A group of labelled choices. It is a native radio group, so arrow keys, Tab, and touch work
 * without extra code, and each whole row is one tap target of at least 48px.
 */
export function MultipleChoiceAnswer({
  question,
  selectedOptionId,
  onSelect,
  feedback,
  disabled = false,
}: MultipleChoiceAnswerProps) {
  const groupName = useId();
  const locked = disabled || feedback !== undefined;

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-4 max-w-reading p-0 font-serif text-body-lg text-ink">{question.prompt}</legend>

      <div className="flex flex-col gap-2">
        {question.options.map((option) => {
          const isSelected = option.id === selectedOptionId;
          const status = feedback ? optionStatus(option, selectedOptionId, feedback) : null;
          const rowClass = [
            rowBase,
            feedback && status ? `${feedbackRow} ${feedbackRowByStatus[status]}` : answeringRow,
          ].join(" ");

          return (
            <label key={option.id} className={rowClass}>
              <input
                type="radio"
                name={groupName}
                value={option.id}
                checked={isSelected}
                disabled={locked}
                onChange={() => onSelect(option.id)}
                className="mt-0.5 size-5 shrink-0 accent-primary"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-body text-ink">{option.text}</span>
                {/* Under the text rather than beside it, so a long option keeps the full width on a phone. */}
                {status === "correct" || status === "incorrect" || (feedback && isSelected) ? (
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {status === "correct" ? (
                      <span className="flex items-center gap-1 text-label text-success">
                        <CircleCheckIcon />
                        Вярно
                      </span>
                    ) : null}
                    {status === "incorrect" ? (
                      <span className="flex items-center gap-1 text-label text-error">
                        <CircleXIcon />
                        Грешно
                      </span>
                    ) : null}
                    {feedback && isSelected ? <span className="text-caption text-muted">Твоят отговор</span> : null}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>

      {feedback && selectedOptionId === null ? (
        <p className="mt-3 text-caption text-muted">Не си избрал отговор.</p>
      ) : null}
    </fieldset>
  );
}
