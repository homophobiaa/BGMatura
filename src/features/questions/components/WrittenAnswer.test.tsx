// @vitest-environment jsdom

import "@/test-support/dom";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { WRITTEN_ANSWER_MAX_LENGTH } from "../answer-limits";
import type { WrittenAnswerProps, WrittenQuestion } from "./WrittenAnswer";
import { WrittenAnswer } from "./WrittenAnswer";

afterEach(cleanup);

const shortQuestion: WrittenQuestion = { id: "s1", type: "short-response", prompt: "Назовете жанра на „Под игото“." };
const extendedQuestion: WrittenQuestion = { id: "e1", type: "extended-response", prompt: "Анализирайте образа на Бай Ганьо." };
const essayQuestion: WrittenQuestion = { id: "a1", type: "argumentative-writing", prompt: "Напишете есе на тема „Авторитетите днес“." };

const SELF_REVIEW_TEXT = "Този отговор не получава автоматична оценка.";

/** Holds the text the way a practice page does, so a test can follow a whole interaction. */
function Harness({ question, initial = "" }: { question: WrittenQuestion; initial?: string }) {
  const [value, setValue] = useState(initial);

  return <WrittenAnswer question={question} value={value} onChange={setValue} />;
}

function field(): HTMLInputElement | HTMLTextAreaElement {
  return screen.getByRole<HTMLInputElement | HTMLTextAreaElement>("textbox");
}

describe("WrittenAnswer", () => {
  describe("the field for each question type", () => {
    it("gives a short response one line, labelled by its prompt", () => {
      render(<WrittenAnswer question={shortQuestion} value="" onChange={() => undefined} />);

      const input = screen.getByRole("textbox", { name: shortQuestion.prompt });
      expect(input.tagName).toBe("INPUT");
      expect(input.getAttribute("type")).toBe("text");
    });

    it.each([extendedQuestion, essayQuestion])("gives an $type answer a labelled textarea", (question) => {
      render(<WrittenAnswer question={question} value="" onChange={() => undefined} />);

      expect(screen.getByRole("textbox", { name: question.prompt }).tagName).toBe("TEXTAREA");
    });

    it("gives the argumentative text more room than an extended response", () => {
      const rowsOf = (question: WrittenQuestion) => {
        const { unmount } = render(<WrittenAnswer question={question} value="" onChange={() => undefined} />);
        const rows = Number(field().getAttribute("rows"));
        unmount();
        return rows;
      };

      expect(rowsOf(essayQuestion)).toBeGreaterThan(rowsOf(extendedQuestion));
    });

    it("declares Bulgarian so spellchecking uses the right language", () => {
      render(<WrittenAnswer question={extendedQuestion} value="" onChange={() => undefined} />);

      expect(field().getAttribute("lang")).toBe("bg");
    });
  });

  describe("self-review explanation", () => {
    it.each([extendedQuestion, essayQuestion])("explains in Bulgarian that an $type answer is not scored automatically", (question) => {
      render(<WrittenAnswer question={question} value="" onChange={() => undefined} />);

      const note = screen.getByText(new RegExp(SELF_REVIEW_TEXT));
      expect(note.textContent).toContain("насоки");
      expect(field().getAttribute("aria-describedby")?.split(" ")).toContain(note.id);
    });

    it("does not show it for a short response", () => {
      render(<WrittenAnswer question={shortQuestion} value="" onChange={() => undefined} />);

      expect(screen.queryByText(new RegExp(SELF_REVIEW_TEXT))).toBeNull();
    });
  });

  describe("typing", () => {
    it("reports the full text as it is typed", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<WrittenAnswer question={shortQuestion} value="" onChange={onChange} />);

      await user.type(field(), "а");

      expect(onChange).toHaveBeenCalledExactlyOnceWith("а");
    });

    it("keeps line breaks of a multiline answer exactly as typed", async () => {
      const user = userEvent.setup();
      render(<Harness question={extendedQuestion} />);

      await user.type(field(), "Първи ред{Enter}{Enter}Втори ред{Enter}");

      expect(field().value).toBe("Първи ред\n\nВтори ред\n");
    });

    it("keeps Bulgarian letters, quotation marks, and spacing untouched", async () => {
      const user = userEvent.setup();
      const text = "  Щастието на ѝ „пътя“ – й, ъ, ь, ю, я.  ";
      render(<Harness question={essayQuestion} />);

      await user.click(field());
      await user.paste(text);

      expect(field().value).toBe(text);
    });

    it("shows what the parent holds, so text survives moving between questions", () => {
      const { unmount } = render(<Harness question={extendedQuestion} initial="Започнат отговор" />);
      expect(field().value).toBe("Започнат отговор");
      unmount();

      render(<WrittenAnswer question={extendedQuestion} value="Започнат отговор" onChange={() => undefined} />);
      expect(field().value).toBe("Започнат отговор");
    });
  });

  describe("limits", () => {
    it.each([shortQuestion, extendedQuestion, essayQuestion])("limits an $type answer to the shared maximum", (question) => {
      render(<WrittenAnswer question={question} value="" onChange={() => undefined} />);

      expect(field().maxLength).toBe(WRITTEN_ANSWER_MAX_LENGTH[question.type]);
    });

    it.each([extendedQuestion, essayQuestion])("shows how much of the limit an $type answer uses", (question) => {
      render(<WrittenAnswer question={question} value="Дума" onChange={() => undefined} />);

      expect(screen.getByText(`4 от ${WRITTEN_ANSWER_MAX_LENGTH[question.type]} знака`)).toBeTruthy();
    });

    it("links the counter to the field", () => {
      render(<WrittenAnswer question={extendedQuestion} value="Дума" onChange={() => undefined} />);

      const counter = screen.getByText(/от 3000 знака/);
      expect(field().getAttribute("aria-describedby")?.split(" ")).toContain(counter.id);
    });

    it("stays quiet for assistive technology until the answer nears its limit", () => {
      const max = WRITTEN_ANSWER_MAX_LENGTH["extended-response"];
      const { rerender } = render(
        <WrittenAnswer question={extendedQuestion} value={"а".repeat(100)} onChange={() => undefined} />,
      );
      const status = screen.getByRole("status");
      expect(status.textContent).toBe("");

      rerender(<WrittenAnswer question={extendedQuestion} value={"а".repeat(max - 50)} onChange={() => undefined} />);
      expect(status.textContent).toBe("Остават 50 знака.");

      rerender(<WrittenAnswer question={extendedQuestion} value={"а".repeat(max - 1)} onChange={() => undefined} />);
      expect(status.textContent).toBe("Остават 1 знак.");

      rerender(<WrittenAnswer question={extendedQuestion} value={"а".repeat(max)} onChange={() => undefined} />);
      expect(status.textContent).toBe(`Достигнат е лимитът от ${max} знака.`);
    });

    it("has no counter on a one-line short response", () => {
      render(<WrittenAnswer question={shortQuestion} value="роман" onChange={() => undefined} />);

      expect(screen.queryByText(/знака/)).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    });
  });

  describe("an empty or invalid submission", () => {
    const message = "Напиши отговор, преди да го изпратиш.";

    it("marks nothing as invalid while there is no error", () => {
      render(<WrittenAnswer question={extendedQuestion} value="" onChange={() => undefined} />);

      expect(field().getAttribute("aria-invalid")).toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("announces the error, ties it to the field, and marks the field invalid", () => {
      render(<WrittenAnswer question={extendedQuestion} value="" onChange={() => undefined} error={message} />);

      const alert = screen.getByRole("alert");
      expect(alert.textContent).toBe(message);
      expect(field().getAttribute("aria-invalid")).toBe("true");
      expect(field().getAttribute("aria-describedby")?.split(" ")).toContain(alert.id);
    });

    it("shows the error with an icon as well as text, and a red border", () => {
      render(<WrittenAnswer question={extendedQuestion} value="" onChange={() => undefined} error={message} />);

      expect(screen.getByRole("alert").querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
      expect(field().className).toContain("border-error");
    });

    it.each([shortQuestion, extendedQuestion])("moves focus to the $type field when an error appears", (question) => {
      const { rerender } = render(<WrittenAnswer question={question} value="" onChange={() => undefined} />);
      expect(document.activeElement).not.toBe(field());

      rerender(<WrittenAnswer question={question} value="" onChange={() => undefined} error={message} />);

      expect(document.activeElement).toBe(field());
    });

    it("takes focus back for a second error after the student moved away", () => {
      const { rerender } = render(<WrittenAnswer question={shortQuestion} value="" onChange={() => undefined} error={message} />);
      (document.activeElement as HTMLElement).blur();

      rerender(<WrittenAnswer question={shortQuestion} value="" onChange={() => undefined} error="Отговорът е твърде дълъг." />);

      expect(document.activeElement).toBe(field());
    });

    it("does not steal focus when the error is cleared", () => {
      const { rerender } = render(<WrittenAnswer question={shortQuestion} value="" onChange={() => undefined} error={message} />);
      (document.activeElement as HTMLElement).blur();

      rerender(<WrittenAnswer question={shortQuestion} value="" onChange={() => undefined} />);

      expect(document.activeElement).not.toBe(field());
    });
  });

  describe("locked while sending", () => {
    it("disables the field and ignores typing", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<WrittenAnswer question={extendedQuestion} value="Текст" onChange={onChange} disabled />);

      await user.type(field(), "ще");
      fireEvent.change(field(), { target: { value: "друго" } });

      expect(field().disabled).toBe(true);
      expect(field().value).toBe("Текст");
    });
  });

  it("takes only the public question: no key, no points, no guidance", () => {
    expectTypeOf<WrittenAnswerProps["question"]>().not.toHaveProperty("assessment");
    expectTypeOf<WrittenAnswerProps["question"]>().not.toHaveProperty("referenceGuidance");
    expectTypeOf<WrittenAnswerProps["question"]>().not.toHaveProperty("acceptedAnswers");
    expectTypeOf<WrittenAnswerProps["question"]["type"]>().toEqualTypeOf<
      "short-response" | "extended-response" | "argumentative-writing"
    >();
  });
});
