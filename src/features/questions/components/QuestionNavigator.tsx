"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface NavigatorItem {
  readonly id: string;
  /** Whether the student has given an answer, as worked out by `isAnswered`. */
  readonly answered: boolean;
}

export interface QuestionNavigatorProps {
  readonly items: readonly NavigatorItem[];
  /** Zero-based index of the question being shown. */
  readonly currentIndex: number;
  /** Called with the zero-based index to show next. The page owns which question is current. */
  readonly onNavigate: (index: number) => void;
}

/**
 * Numbered navigation between the questions of an exam or practice session: the position,
 * a button per question marked answered or not and current or not, and back and next buttons.
 *
 * Status is never colour alone: an answered question carries a check mark, the current one a thick
 * border, and every button's accessible name says both. The component only navigates; the page
 * keeps the answers (see `useAnswerDrafts`), so each answer is still there when a student returns.
 */
export function QuestionNavigator({ items, currentIndex, onNavigate }: QuestionNavigatorProps) {
  const total = items.length;

  if (total === 0) {
    return null;
  }

  const answeredCount = items.filter((item) => item.answered).length;
  const isFirst = currentIndex <= 0;
  const isLast = currentIndex >= total - 1;

  return (
    <nav aria-label="Навигация по въпросите" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-title text-ink">
          Въпрос {currentIndex + 1} от {total}
        </p>
        <p className="text-caption text-muted">
          Отговорени: {answeredCount} от {total}
        </p>
      </div>

      <ol className="flex flex-wrap gap-2">
        {items.map((item, index) => {
          const isCurrent = index === currentIndex;

          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onNavigate(index)}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`Въпрос ${index + 1}, ${item.answered ? "с отговор" : "без отговор"}${isCurrent ? ", текущ" : ""}`}
                className={cn(
                  "relative inline-flex size-11 items-center justify-center rounded-md border text-label tabular-nums text-ink",
                  "hover:bg-surface-soft motion-reduce:transition-none",
                  item.answered ? "bg-surface-card" : "bg-canvas",
                  isCurrent
                    ? "border-2 border-primary bg-surface-strong font-semibold"
                    : "border-border-control",
                )}
              >
                {index + 1}
                {item.answered ? (
                  <Check
                    aria-hidden="true"
                    strokeWidth={3}
                    className="absolute -right-1 -top-1 size-4 rounded-full bg-success p-0.5 text-on-primary"
                  />
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>

      <p className="max-w-reading text-caption text-muted">
        Отметката ✓ показва въпрос с отговор. Удебелената рамка показва текущия въпрос.
      </p>

      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" disabled={isFirst} onClick={() => onNavigate(currentIndex - 1)}>
          <ChevronLeft aria-hidden="true" />
          Назад
        </Button>
        <Button disabled={isLast} onClick={() => onNavigate(currentIndex + 1)}>
          Напред
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
