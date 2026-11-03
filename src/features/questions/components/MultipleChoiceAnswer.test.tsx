// @vitest-environment jsdom

import "@/test-support/dom";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import type { MultipleChoiceQuestion } from "../types";
import { MultipleChoiceAnswer } from "./MultipleChoiceAnswer";
import type { MultipleChoiceAnswerProps } from "./MultipleChoiceAnswer";

afterEach(cleanup);

const question: MultipleChoiceQuestion = {
  id: "question-1",
  type: "multiple-choice",
  prompt: "Кой е авторът на „Под игото“?",
  options: [
    { id: "a", text: "Иван Вазов" },
    { id: "b", text: "Пейо Яворов" },
    { id: "c", text: "Елин Пелин" },
  ],
};

function radios(): HTMLInputElement[] {
  return screen.getAllByRole<HTMLInputElement>("radio");
}

function selectedTexts(): string[] {
  return radios()
    .filter((radio) => radio.checked)
    .map((radio) => radio.value);
}

/** Holds the choice the way a practice page does, so a test can follow a whole interaction. */
function Harness({ initial = null }: { initial?: string | null }) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(initial);

  return <MultipleChoiceAnswer question={question} selectedOptionId={selectedOptionId} onSelect={setSelectedOptionId} />;
}

describe("MultipleChoiceAnswer", () => {
  describe("structure", () => {
    it("names the group with the prompt and labels every choice", () => {
      render(<MultipleChoiceAnswer question={question} selectedOptionId={null} onSelect={() => undefined} />);

      expect(screen.getByRole("group", { name: "Кой е авторът на „Под игото“?" })).toBeTruthy();
      expect(radios().map((radio) => radio.labels?.[0]?.textContent)).toEqual([
        "Иван Вазов",
        "Пейо Яворов",
        "Елин Пелин",
      ]);
      expect(screen.getByRole("radio", { name: "Пейо Яворов" })).toBeTruthy();
    });

    it("starts with nothing selected and shows the selection it is given", () => {
      const { rerender } = render(
        <MultipleChoiceAnswer question={question} selectedOptionId={null} onSelect={() => undefined} />,
      );
      expect(selectedTexts()).toEqual([]);

      rerender(<MultipleChoiceAnswer question={question} selectedOptionId="b" onSelect={() => undefined} />);
      expect(selectedTexts()).toEqual(["b"]);
    });

    it("keeps the choices of two questions on one page independent", async () => {
      const user = userEvent.setup();
      render(
        <>
          <Harness />
          <Harness initial="c" />
        </>,
      );

      await user.click(screen.getAllByRole("radio", { name: "Иван Вазов" })[0] as HTMLElement);

      const [first, second] = [radios().slice(0, 3), radios().slice(3)];
      expect(first.filter((radio) => radio.checked).map((radio) => radio.value)).toEqual(["a"]);
      expect(second.filter((radio) => radio.checked).map((radio) => radio.value)).toEqual(["c"]);
    });
  });

  describe("selecting", () => {
    it("reports the chosen option when a row is clicked or tapped", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<MultipleChoiceAnswer question={question} selectedOptionId={null} onSelect={onSelect} />);

      await user.click(screen.getByText("Елин Пелин"));

      expect(onSelect).toHaveBeenCalledExactlyOnceWith("c");
    });

    it("works with the keyboard: Tab into the group, arrow keys to move, and Space to choose", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.tab();
      expect(document.activeElement).toBe(radios()[0]);

      await user.keyboard("{ArrowDown}");
      expect(selectedTexts()).toEqual(["b"]);
      expect(document.activeElement).toBe(radios()[1]);

      await user.keyboard("{ArrowDown}{ArrowDown}");
      expect(selectedTexts()).toEqual(["a"]);

      await user.keyboard("{ArrowUp}");
      expect(selectedTexts()).toEqual(["c"]);
    });

    it("lets Space choose the focused option", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<MultipleChoiceAnswer question={question} selectedOptionId={null} onSelect={onSelect} />);

      await user.tab();
      await user.keyboard(" ");

      expect(onSelect).toHaveBeenCalledExactlyOnceWith("a");
    });

    it("shows only what the parent says is selected", async () => {
      const user = userEvent.setup();
      render(<MultipleChoiceAnswer question={question} selectedOptionId="a" onSelect={() => undefined} />);

      await user.click(screen.getByText("Пейо Яворов"));

      expect(selectedTexts()).toEqual(["a"]);
    });

    it("keeps the choice when the parent keeps it, for example across moving between questions", async () => {
      const user = userEvent.setup();
      let saved: string | null = null;
      const { unmount } = render(
        <MultipleChoiceAnswer question={question} selectedOptionId={saved} onSelect={(id) => (saved = id)} />,
      );
      await user.click(screen.getByText("Пейо Яворов"));
      unmount();

      render(<MultipleChoiceAnswer question={question} selectedOptionId={saved} onSelect={() => undefined} />);

      expect(selectedTexts()).toEqual(["b"]);
    });
  });

  describe("locked while sending", () => {
    it("disables every option without marking any as right or wrong", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<MultipleChoiceAnswer question={question} selectedOptionId="a" onSelect={onSelect} disabled />);

      await user.click(screen.getByText("Пейо Яворов"));

      expect(radios().every((radio) => radio.disabled)).toBe(true);
      expect(onSelect).not.toHaveBeenCalled();
      expect(screen.queryByText("Вярно")).toBeNull();
      expect(screen.queryByText("Грешно")).toBeNull();
    });
  });

  describe("answering state is separate from feedback state", () => {
    it("shows no result while answering", () => {
      render(<MultipleChoiceAnswer question={question} selectedOptionId="b" onSelect={() => undefined} />);

      expect(screen.queryByText("Вярно")).toBeNull();
      expect(screen.queryByText("Грешно")).toBeNull();
      expect(screen.queryByText("Твоят отговор")).toBeNull();
      expect(radios().every((radio) => !radio.disabled)).toBe(true);
    });

    it("marks a wrong choice and the right answer, with text, and locks the options", () => {
      render(
        <MultipleChoiceAnswer
          question={question}
          selectedOptionId="b"
          onSelect={() => undefined}
          feedback={{ correctOptionId: "a" }}
        />,
      );

      expect(radios().every((radio) => radio.disabled)).toBe(true);
      expect(screen.getByRole("radio", { name: /Иван Вазов/ }).closest("label")?.textContent).toContain("Вярно");
      const chosen = screen.getByRole("radio", { name: /Пейо Яворов/ }).closest("label");
      expect(chosen?.textContent).toContain("Грешно");
      expect(chosen?.textContent).toContain("Твоят отговор");
      expect(screen.getByRole("radio", { name: /Елин Пелин/ }).closest("label")?.textContent).toBe("Елин Пелин");
    });

    it("marks a right choice as right only", () => {
      render(
        <MultipleChoiceAnswer
          question={question}
          selectedOptionId="a"
          onSelect={() => undefined}
          feedback={{ correctOptionId: "a" }}
        />,
      );

      expect(screen.getAllByText("Вярно")).toHaveLength(1);
      expect(screen.queryByText("Грешно")).toBeNull();
      expect(screen.getByText("Твоят отговор")).toBeTruthy();
    });

    it("still shows the right answer, and says so, when the student chose nothing", () => {
      render(
        <MultipleChoiceAnswer
          question={question}
          selectedOptionId={null}
          onSelect={() => undefined}
          feedback={{ correctOptionId: "c" }}
        />,
      );

      expect(screen.getByRole("radio", { name: /Елин Пелин/ }).closest("label")?.textContent).toContain("Вярно");
      expect(screen.getByText("Не си избрал отговор.")).toBeTruthy();
      expect(screen.queryByText("Грешно")).toBeNull();
    });

    it("uses an icon with each result, hidden from assistive technology", () => {
      const { container } = render(
        <MultipleChoiceAnswer
          question={question}
          selectedOptionId="b"
          onSelect={() => undefined}
          feedback={{ correctOptionId: "a" }}
        />,
      );

      const icons = container.querySelectorAll("svg");
      expect(icons).toHaveLength(2);
      for (const icon of icons) {
        expect(icon.getAttribute("aria-hidden")).toBe("true");
      }
    });
  });

  it("takes a public question with no answer key, and feedback only as a separate prop", () => {
    expectTypeOf<MultipleChoiceAnswerProps["question"]>().not.toHaveProperty("assessment");
    expectTypeOf<MultipleChoiceAnswerProps["question"]>().not.toHaveProperty("correctOptionId");
    expectTypeOf<MultipleChoiceAnswerProps["feedback"]>().toEqualTypeOf<{ readonly correctOptionId: string } | undefined>();
  });
});
