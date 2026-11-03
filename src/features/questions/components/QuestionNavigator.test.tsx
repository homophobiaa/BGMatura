// @vitest-environment jsdom

import "@/test-support/dom";

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { choiceFromDraft, toNavigatorItems, useAnswerDrafts } from "../answer-drafts";
import type { Question } from "../types";
import { MultipleChoiceAnswer } from "./MultipleChoiceAnswer";
import { QuestionNavigator } from "./QuestionNavigator";
import type { NavigatorItem } from "./QuestionNavigator";
import { WrittenAnswer } from "./WrittenAnswer";

afterEach(cleanup);

const items = (answered: readonly boolean[]): NavigatorItem[] =>
  answered.map((isAnswered, index) => ({ id: `q${index + 1}`, answered: isAnswered }));

function tileFor(number: number): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(`^Въпрос ${number},`) });
}

describe("QuestionNavigator", () => {
  describe("position and markers", () => {
    it("says which question is shown and how many are answered", () => {
      render(<QuestionNavigator items={items([true, false, true, false])} currentIndex={2} onNavigate={() => undefined} />);

      expect(screen.getByText("Въпрос 3 от 4")).toBeTruthy();
      expect(screen.getByText("Отговорени: 2 от 4")).toBeTruthy();
    });

    it("has a numbered button for every question, in order", () => {
      render(<QuestionNavigator items={items([false, false, false])} currentIndex={0} onNavigate={() => undefined} />);

      const list = screen.getByRole("list");
      expect(within(list).getAllByRole("listitem")).toHaveLength(3);
      expect(within(list).getAllByRole("button").map((button) => button.textContent)).toEqual(["1", "2", "3"]);
    });

    it("lands in a labelled navigation region", () => {
      render(<QuestionNavigator items={items([false])} currentIndex={0} onNavigate={() => undefined} />);

      expect(screen.getByRole("navigation", { name: "Навигация по въпросите" })).toBeTruthy();
    });

    it("names each button with its number and whether it has an answer and is current", () => {
      render(<QuestionNavigator items={items([true, false, true])} currentIndex={1} onNavigate={() => undefined} />);

      expect(screen.getByRole("button", { name: "Въпрос 1, с отговор" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Въпрос 2, без отговор, текущ" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Въпрос 3, с отговор" })).toBeTruthy();
    });

    it("marks only the current question, with aria-current", () => {
      render(<QuestionNavigator items={items([false, false, false])} currentIndex={1} onNavigate={() => undefined} />);

      expect(tileFor(2).getAttribute("aria-current")).toBe("step");
      expect(tileFor(1).getAttribute("aria-current")).toBeNull();
      expect(tileFor(3).getAttribute("aria-current")).toBeNull();
    });

    it("never relies on colour alone: an answered question has a check mark, the current one a thick border", () => {
      render(<QuestionNavigator items={items([true, false, false])} currentIndex={1} onNavigate={() => undefined} />);

      const checkMark = (tile: HTMLElement) => tile.querySelector("svg");
      expect(checkMark(tileFor(1))?.getAttribute("aria-hidden")).toBe("true");
      expect(checkMark(tileFor(2))).toBeNull();
      expect(checkMark(tileFor(3))).toBeNull();
      expect(tileFor(2).className).toContain("border-2");
      expect(tileFor(2).className).toContain("border-primary");
      expect(tileFor(1).className).not.toContain("border-primary");
    });

    it("explains the markers in text", () => {
      render(<QuestionNavigator items={items([false])} currentIndex={0} onNavigate={() => undefined} />);

      expect(screen.getByText(/Отметката ✓ показва въпрос с отговор/)).toBeTruthy();
    });

    it("keeps every button a 44px touch target with at least 8px between them", () => {
      render(<QuestionNavigator items={items([false, false])} currentIndex={0} onNavigate={() => undefined} />);

      expect(tileFor(1).className).toContain("size-11");
      expect(screen.getByRole("list").className).toContain("gap-2");
    });

    it("renders nothing when there are no questions", () => {
      const { container } = render(<QuestionNavigator items={[]} currentIndex={0} onNavigate={() => undefined} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("moving", () => {
    it("jumps to the question whose number is chosen", async () => {
      const user = userEvent.setup();
      const onNavigate = vi.fn();
      render(<QuestionNavigator items={items([false, false, false, false])} currentIndex={0} onNavigate={onNavigate} />);

      await user.click(tileFor(3));

      expect(onNavigate).toHaveBeenCalledExactlyOnceWith(2);
    });

    it("goes to the next and the previous question", async () => {
      const user = userEvent.setup();
      const onNavigate = vi.fn();
      render(<QuestionNavigator items={items([false, false, false])} currentIndex={1} onNavigate={onNavigate} />);

      await user.click(screen.getByRole("button", { name: "Напред" }));
      await user.click(screen.getByRole("button", { name: "Назад" }));

      expect(onNavigate.mock.calls).toEqual([[2], [0]]);
    });

    it("cannot go back from the first question", async () => {
      const user = userEvent.setup();
      const onNavigate = vi.fn();
      render(<QuestionNavigator items={items([false, false])} currentIndex={0} onNavigate={onNavigate} />);

      const back = screen.getByRole<HTMLButtonElement>("button", { name: "Назад" });
      await user.click(back);

      expect(back.disabled).toBe(true);
      expect(screen.getByRole<HTMLButtonElement>("button", { name: "Напред" }).disabled).toBe(false);
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it("cannot go forward from the last question", async () => {
      const user = userEvent.setup();
      const onNavigate = vi.fn();
      render(<QuestionNavigator items={items([false, false])} currentIndex={1} onNavigate={onNavigate} />);

      const next = screen.getByRole<HTMLButtonElement>("button", { name: "Напред" });
      await user.click(next);

      expect(next.disabled).toBe(true);
      expect(screen.getByRole<HTMLButtonElement>("button", { name: "Назад" }).disabled).toBe(false);
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it("works for a session with one question", () => {
      render(<QuestionNavigator items={items([false])} currentIndex={0} onNavigate={() => undefined} />);

      expect(screen.getByRole<HTMLButtonElement>("button", { name: "Назад" }).disabled).toBe(true);
      expect(screen.getByRole<HTMLButtonElement>("button", { name: "Напред" }).disabled).toBe(true);
    });
  });

  describe("keyboard", () => {
    it("reaches every numbered button and then back and next with Tab, in reading order", async () => {
      const user = userEvent.setup();
      render(<QuestionNavigator items={items([false, false, false])} currentIndex={1} onNavigate={() => undefined} />);

      const visited: string[] = [];
      for (let step = 0; step < 5; step += 1) {
        await user.tab();
        visited.push(document.activeElement?.textContent?.trim() ?? "");
      }

      expect(visited).toEqual(["1", "2", "3", "Назад", "Напред"]);
    });

    it("moves with Enter and with Space", async () => {
      const user = userEvent.setup();
      const onNavigate = vi.fn();
      render(<QuestionNavigator items={items([false, false, false])} currentIndex={0} onNavigate={onNavigate} />);

      await user.tab();
      await user.tab();
      await user.keyboard("{Enter}");
      await user.tab();
      await user.keyboard(" ");

      expect(onNavigate.mock.calls).toEqual([[1], [2]]);
    });
  });
});

/** A small exam: a page that holds the answers and shows one question at a time with the real controls. */
const questions: Question[] = [
  {
    id: "choice-1",
    type: "multiple-choice",
    prompt: "Кой е авторът на „Под игото“?",
    options: [
      { id: "a", text: "Иван Вазов" },
      { id: "b", text: "Пейо Яворов" },
      { id: "c", text: "Елин Пелин" },
    ],
  },
  { id: "short-1", type: "short-response", prompt: "Назовете жанра на „Под игото“." },
  { id: "extended-1", type: "extended-response", prompt: "Анализирайте образа на Бай Ганьо." },
  {
    id: "choice-2",
    type: "multiple-choice",
    prompt: "Кой жанр е „Градушка“?",
    options: [
      { id: "x", text: "Разказ" },
      { id: "y", text: "Стихотворение" },
    ],
  },
];

function MiniExam() {
  const [index, setIndex] = useState(0);
  const { drafts, setDraft } = useAnswerDrafts();
  const question = questions[index] as Question;

  return (
    <>
      <QuestionNavigator items={toNavigatorItems(questions, drafts)} currentIndex={index} onNavigate={setIndex} />
      {question.type === "multiple-choice" ? (
        <MultipleChoiceAnswer
          key={question.id}
          question={question}
          selectedOptionId={choiceFromDraft(drafts[question.id])}
          onSelect={(optionId) => setDraft(question.id, optionId)}
        />
      ) : (
        <WrittenAnswer
          key={question.id}
          question={question}
          value={drafts[question.id] ?? ""}
          onChange={(value) => setDraft(question.id, value)}
        />
      )}
    </>
  );
}

describe("moving around an exam keeps every answer", () => {
  it("restores a chosen option and typed text, however the student moves", async () => {
    const user = userEvent.setup();
    render(<MiniExam />);

    // Q1: choose an option.
    await user.click(screen.getByRole("radio", { name: "Пейо Яворов" }));
    // Q3 by jumping: type a multiline answer.
    await user.click(tileFor(3));
    await user.type(screen.getByRole("textbox"), "Първи ред{Enter}{Enter}Втори ред");
    // Q2 with next/back: type a short answer.
    await user.click(screen.getByRole("button", { name: "Назад" }));
    await user.type(screen.getByRole("textbox"), "роман");
    // Q4 by jumping: choose an option.
    await user.click(tileFor(4));
    await user.click(screen.getByRole("radio", { name: "Стихотворение" }));

    // Come back to each one.
    await user.click(tileFor(1));
    expect(screen.getByRole<HTMLInputElement>("radio", { name: "Пейо Яворов" }).checked).toBe(true);

    await user.click(screen.getByRole("button", { name: "Напред" }));
    expect(screen.getByRole<HTMLInputElement>("textbox").value).toBe("роман");

    await user.click(screen.getByRole("button", { name: "Напред" }));
    expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe("Първи ред\n\nВтори ред");

    await user.click(screen.getByRole("button", { name: "Напред" }));
    expect(screen.getByRole<HTMLInputElement>("radio", { name: "Стихотворение" }).checked).toBe(true);
  });

  it("updates the markers as answers are given and removed", async () => {
    const user = userEvent.setup();
    render(<MiniExam />);
    expect(screen.getByText("Отговорени: 0 от 4")).toBeTruthy();

    await user.click(screen.getByRole("radio", { name: "Иван Вазов" }));
    expect(screen.getByRole("button", { name: "Въпрос 1, с отговор, текущ" })).toBeTruthy();
    expect(screen.getByText("Отговорени: 1 от 4")).toBeTruthy();

    await user.click(tileFor(2));
    await user.type(screen.getByRole("textbox"), "   ");
    expect(screen.getByRole("button", { name: "Въпрос 2, без отговор, текущ" })).toBeTruthy();
    expect(screen.getByText("Отговорени: 1 от 4")).toBeTruthy();

    await user.type(screen.getByRole("textbox"), "роман");
    expect(screen.getByRole("button", { name: "Въпрос 2, с отговор, текущ" })).toBeTruthy();
    expect(screen.getByText("Отговорени: 2 от 4")).toBeTruthy();

    await user.clear(screen.getByRole("textbox"));
    expect(screen.getByRole("button", { name: "Въпрос 2, без отговор, текущ" })).toBeTruthy();
    expect(screen.getByText("Отговорени: 1 от 4")).toBeTruthy();
  });

  it("does not lose an answer when the student only passes through a question", async () => {
    const user = userEvent.setup();
    render(<MiniExam />);

    await user.click(screen.getByRole("radio", { name: "Елин Пелин" }));
    await user.click(screen.getByRole("button", { name: "Напред" }));
    await user.click(screen.getByRole("button", { name: "Напред" }));
    await user.click(screen.getByRole("button", { name: "Назад" }));
    await user.click(screen.getByRole("button", { name: "Назад" }));

    expect(screen.getByRole<HTMLInputElement>("radio", { name: "Елин Пелин" }).checked).toBe(true);
  });
});
