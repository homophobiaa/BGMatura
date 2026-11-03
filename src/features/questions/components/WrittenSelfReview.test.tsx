// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, expectTypeOf, it } from "vitest";

import { WrittenSelfReview } from "./WrittenSelfReview";
import type { SelfReviewCriterion, WrittenSelfReviewProps } from "./WrittenSelfReview";

afterEach(cleanup);

const rubric: SelfReviewCriterion[] = [
  { id: "thesis", description: "Ясна теза, свързана с темата", indicativePoints: 4 },
  { id: "arguments", description: "Убедителни аргументи с примери", indicativePoints: 1 },
  { id: "style", description: "Точен и изразителен език" },
];

const base: WrittenSelfReviewProps = {
  prompt: "Напишете аргументативен текст на тема „Авторитетите днес“.",
  submittedText: "Авторитетите днес са многолики.\n\nВ моя поглед авторитетът се гради с примери.",
  status: "self-review",
  referenceGuidance: "Очаква се ясна теза.\nСлед нея – аргументи и извод.",
  rubric,
};

function show(overrides: Partial<WrittenSelfReviewProps> = {}) {
  return render(<WrittenSelfReview {...base} {...overrides} />);
}

describe("WrittenSelfReview", () => {
  describe("what is shown", () => {
    it("shows the prompt, the submitted writing, the guidance, and the criteria", () => {
      show();

      expect(screen.getByText(base.prompt)).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Твоят отговор" })).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Насоки за самооценка" })).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Критерии" })).toBeTruthy();
      expect(screen.getByText(/Очаква се ясна теза/)).toBeTruthy();
      expect(screen.getAllByRole("listitem")).toHaveLength(3);
    });

    it("sits in a labelled article, with each part in a labelled section", () => {
      show();

      expect(screen.getByRole("article", { name: "Преглед на писмен отговор" })).toBeTruthy();
      expect(screen.getByRole("region", { name: "Твоят отговор" })).toBeTruthy();
      expect(screen.getByRole("region", { name: "Насоки за самооценка" })).toBeTruthy();
      expect(screen.getByRole("region", { name: "Критерии" })).toBeTruthy();
    });
  });

  describe("status without machine points", () => {
    it("labels a self-review answer, with an icon, and explains that there are no automatic points", () => {
      show({ status: "self-review" });

      const label = screen.getByText("За самооценка");
      expect(label.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
      expect(screen.getByText(/няма автоматична оценка и системата не му дава точки/)).toBeTruthy();
      expect(screen.getByText(/сам прецени как си се справил/)).toBeTruthy();
    });

    it("labels an ungraded answer differently and still gives no points", () => {
      show({ status: "ungraded" });

      expect(screen.getByText("Без автоматична оценка")).toBeTruthy();
      expect(screen.queryByText("За самооценка")).toBeNull();
      expect(screen.getByText(/не се оценява автоматично и системата не му дава точки/)).toBeTruthy();
    });

    it.each(["self-review", "ungraded"] as const)("never shows an earned score, a maximum, or a percentage for %s", (status) => {
      const { container } = show({ status });
      const text = container.textContent ?? "";

      expect(text).not.toMatch(/\d+\s*(\/|от)\s*\d+\s*(т\.|точки)/);
      expect(text).not.toMatch(/\d+\s*%/);
      expect(text).not.toMatch(/Твоят резултат|Резултат:|Получени точки|Максимален брой|Максимум/i);
      expect(text).not.toMatch(/вярно|грешно/i);
    });

    it("takes no score at all: there is nowhere to pass earned or maximum points", () => {
      expectTypeOf<WrittenSelfReviewProps>().not.toHaveProperty("earnedPoints");
      expectTypeOf<WrittenSelfReviewProps>().not.toHaveProperty("maximumPoints");
      expectTypeOf<WrittenSelfReviewProps>().not.toHaveProperty("score");
      expectTypeOf<WrittenSelfReviewProps["status"]>().toEqualTypeOf<"self-review" | "ungraded">();
    });
  });

  describe("the rubric", () => {
    it("labels rubric points as a guide, not as a score, and says they are not added to the result", () => {
      show();

      expect(screen.getByText("Ориентировъчно: до 4 точки")).toBeTruthy();
      expect(screen.getByText("Ориентировъчно: до 1 точка")).toBeTruthy();
      expect(screen.getByText(/Точките са ориентировъчни.*Те не се добавят към резултата ти/)).toBeTruthy();
    });

    it("shows a criterion without points as plain text", () => {
      show();

      const item = screen.getByText("Точен и изразителен език").closest("li");
      expect(item?.textContent).toBe("Точен и изразителен език");
    });

    it("does not mention points when no criterion has any", () => {
      show({ rubric: [{ id: "a", description: "Само описание" }] });

      expect(screen.queryByText(/Ориентировъчно/)).toBeNull();
      expect(screen.queryByText(/Точките са ориентировъчни/)).toBeNull();
    });

    it("leaves out the criteria section when there is no rubric", () => {
      show({ rubric: [] });

      expect(screen.queryByRole("heading", { name: "Критерии" })).toBeNull();
      expect(screen.queryByRole("list")).toBeNull();
    });

    it("writes half points the Bulgarian way", () => {
      show({ rubric: [{ id: "a", description: "Правопис", indicativePoints: 0.5 }] });

      expect(screen.getByText("Ориентировъчно: до 0,5 точки")).toBeTruthy();
    });
  });

  describe("the student's writing", () => {
    it("keeps line breaks and spacing exactly as submitted", () => {
      show({ submittedText: "Първи ред\n\nВтори ред\n   с отстъп" });

      const writing = screen.getByText(/Първи ред/);
      expect(writing.textContent).toBe("Първи ред\n\nВтори ред\n   с отстъп");
      expect(writing.className).toContain("whitespace-pre-wrap");
    });

    it("wraps very long words instead of overflowing", () => {
      show({ submittedText: "а".repeat(300) });

      expect(screen.getByText("а".repeat(300)).className).toContain("[overflow-wrap:anywhere]");
    });

    it("keeps a long Bulgarian text whole and readable", () => {
      const long = Array.from({ length: 400 }, (_, index) => `Изречение номер ${index + 1} от дългия текст.`).join(" ");
      show({ submittedText: long });

      const writing = screen.getByText(/Изречение номер 1 от/);
      expect(writing.textContent).toBe(long);
      expect(writing.className).toContain("max-w-reading");
    });

    it.each(["", " ", "\n", " \t\r\n "])("says nothing was written for %j and does not show an empty quote", (blank) => {
      show({ submittedText: blank });

      const section = screen.getByRole("region", { name: "Твоят отговор" });
      expect(within(section).getByText("Не си написал отговор.")).toBeTruthy();
      expect(section.querySelectorAll("p")).toHaveLength(1);
    });

    it("does not say nothing was written when something was", () => {
      show();

      expect(screen.queryByText("Не си написал отговор.")).toBeNull();
    });
  });

  describe("the guidance", () => {
    it("keeps the paragraphs of the guidance", () => {
      show({ referenceGuidance: "Първа мисъл.\nВтора мисъл." });

      const guidance = screen.getByText(/Първа мисъл/);
      expect(guidance.textContent).toBe("Първа мисъл.\nВтора мисъл.");
      expect(guidance.className).toContain("whitespace-pre-line");
    });
  });

  it("takes the rubric captured on the server as it is", () => {
    expectTypeOf<SelfReviewCriterion>().toMatchTypeOf<{ id: string; description: string; indicativePoints?: number }>();
  });
});
