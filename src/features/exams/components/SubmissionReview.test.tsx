// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SubmissionReview } from "./SubmissionReview";
import type { SubmissionReviewProps, SubmissionStatus } from "./SubmissionReview";

afterEach(cleanup);

const reviewing: SubmissionStatus = { phase: "reviewing" };

function show(overrides: Partial<SubmissionReviewProps> = {}) {
  const props: SubmissionReviewProps = {
    total: 10,
    unansweredIndexes: [2, 4],
    status: reviewing,
    onConfirm: vi.fn(),
    onGoToQuestion: vi.fn(),
    ...overrides,
  };

  return { props, ...render(<SubmissionReview {...props} />) };
}

async function openConfirmation(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Предай матурата" }));
}

describe("SubmissionReview", () => {
  describe("the counts", () => {
    it("shows how many questions are answered and how many are not", () => {
      show();

      expect(screen.getByRole("heading", { level: 2, name: "Преглед преди предаване" })).toBeTruthy();
      expect(screen.getByText("Отговорени").nextElementSibling?.textContent).toBe("8 от 10");
      expect(screen.getByText("Без отговор").nextElementSibling?.textContent).toBe("2 от 10");
    });

    it("lets the student go back to an unanswered question, with its number", async () => {
      const user = userEvent.setup();
      const { props } = show();

      await user.click(screen.getByRole("button", { name: "Върни се към въпрос 5" }));

      expect(screen.getAllByRole("button", { name: /^Върни се към въпрос/ }).map((button) => button.textContent)).toEqual(["3", "5"]);
      expect(props.onGoToQuestion).toHaveBeenCalledExactlyOnceWith(4);
    });

    it("says so when every question is answered, with nothing to go back to", () => {
      show({ unansweredIndexes: [] });

      expect(screen.getByText("Отговори си на всички въпроси.")).toBeTruthy();
      expect(screen.queryByRole("button", { name: /Върни се към въпрос/ })).toBeNull();
      expect(screen.getByText("Без отговор").nextElementSibling?.textContent).toBe("0 от 10");
    });

    it("handles an exam where nothing is answered", () => {
      show({ total: 3, unansweredIndexes: [0, 1, 2] });

      expect(screen.getByText("Отговорени").nextElementSibling?.textContent).toBe("0 от 3");
      expect(screen.getAllByRole("button", { name: /Върни се към въпрос/ })).toHaveLength(3);
    });

    it("makes the unanswered buttons 44px touch targets", () => {
      show();

      expect(screen.getByRole("button", { name: "Върни се към въпрос 3" }).className).toContain("size-11");
    });
  });

  describe("finality is explained before confirming", () => {
    it("states that submitting is final and what happens to written answers", () => {
      show();

      expect(screen.getByText("Предаването е окончателно")).toBeTruthy();
      expect(screen.getByText(/не можеш да променяш отговорите си/)).toBeTruthy();
      expect(screen.getByText(/писмен текст не получават автоматична оценка/)).toBeTruthy();
    });

    it("explains it before any confirmation step is opened", () => {
      show();

      expect(screen.queryByText("Сигурен ли си, че искаш да предадеш матурата?")).toBeNull();
      expect(screen.getByText("Предаването е окончателно")).toBeTruthy();
    });
  });

  describe("an explicit second step", () => {
    it("does not submit on the first click, and asks for confirmation", async () => {
      const user = userEvent.setup();
      const { props } = show();

      await openConfirmation(user);

      expect(props.onConfirm).not.toHaveBeenCalled();
      expect(screen.getByRole("group", { name: "Сигурен ли си, че искаш да предадеш матурата?" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Да, предай матурата" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Предай матурата" })).toBeNull();
    });

    it("moves focus to the question so a keyboard or screen reader user lands on it", async () => {
      const user = userEvent.setup();
      show();

      await openConfirmation(user);

      expect(document.activeElement?.textContent).toBe("Сигурен ли си, че искаш да предадеш матурата?");
    });

    it("goes back to the questions without submitting", async () => {
      const user = userEvent.setup();
      const { props } = show();

      await openConfirmation(user);
      await user.click(screen.getByRole("button", { name: "Назад към въпросите" }));

      expect(props.onConfirm).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Предай матурата" })).toBeTruthy();
      expect(screen.queryByRole("group")).toBeNull();
    });

    it("submits once when confirmed", async () => {
      const user = userEvent.setup();
      const { props } = show();

      await openConfirmation(user);
      await user.click(screen.getByRole("button", { name: "Да, предай матурата" }));

      expect(props.onConfirm).toHaveBeenCalledOnce();
    });
  });

  describe("no duplicate requests", () => {
    it("sends one request however fast the confirm button is clicked, before the page updates", async () => {
      const user = userEvent.setup();
      const { props } = show();
      await openConfirmation(user);
      const confirm = screen.getByRole("button", { name: "Да, предай матурата" });

      fireEvent.click(confirm);
      fireEvent.click(confirm);
      fireEvent.click(confirm);

      expect(props.onConfirm).toHaveBeenCalledOnce();
    });

    it("locks everything while the submission is in progress", async () => {
      const onConfirm = vi.fn();
      const onGoToQuestion = vi.fn();
      render(
        <SubmissionReview
          total={10}
          unansweredIndexes={[2]}
          status={{ phase: "submitting" }}
          onConfirm={onConfirm}
          onGoToQuestion={onGoToQuestion}
        />,
      );
      const user = userEvent.setup();

      const submit = screen.getByRole<HTMLButtonElement>("button", { name: "Предаване…" });
      await user.click(submit);
      await user.click(screen.getByRole("button", { name: "Върни се към въпрос 3" }));
      await user.click(screen.getByRole("button", { name: "Назад към въпросите" }));

      expect(submit.disabled).toBe(true);
      expect(submit.getAttribute("aria-busy")).toBe("true");
      expect(onConfirm).not.toHaveBeenCalled();
      expect(onGoToQuestion).not.toHaveBeenCalled();
    });

    it("shows a submitting state in text and with a spinner, announced politely", () => {
      render(
        <SubmissionReview
          total={5}
          unansweredIndexes={[]}
          status={{ phase: "submitting" }}
          onConfirm={() => undefined}
          onGoToQuestion={() => undefined}
        />,
      );

      const status = screen.getByRole("status");
      expect(status.textContent).toBe("Предаваме отговорите ти…");
      expect(status.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    });
  });

  describe("a submission that fails", () => {
    const failed: SubmissionStatus = { phase: "failed", message: "Връзката се прекъсна." };

    it("says what happened, that the answers are kept, and offers to try again", () => {
      render(
        <SubmissionReview total={5} unansweredIndexes={[]} status={failed} onConfirm={() => undefined} onGoToQuestion={() => undefined} />,
      );

      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("Връзката се прекъсна.");
      expect(alert.textContent).toContain("Отговорите ти са запазени и можеш да опиташ отново.");
      expect(screen.getByRole<HTMLButtonElement>("button", { name: "Опитай отново" }).disabled).toBe(false);
    });

    it("sends the request again when the student retries", async () => {
      const onConfirm = vi.fn();
      const user = userEvent.setup();
      render(
        <SubmissionReview total={5} unansweredIndexes={[]} status={failed} onConfirm={onConfirm} onGoToQuestion={() => undefined} />,
      );

      await user.click(screen.getByRole("button", { name: "Опитай отново" }));

      expect(onConfirm).toHaveBeenCalledOnce();
    });
  });

  describe("an attempt that is already submitted", () => {
    const submitted: SubmissionStatus = { phase: "submitted", resultHref: "/rezultati/abc" };

    it("shows that it is submitted and the way to the result, with nothing left to submit", () => {
      render(
        <SubmissionReview total={5} unansweredIndexes={[1]} status={submitted} onConfirm={() => undefined} onGoToQuestion={() => undefined} />,
      );

      expect(screen.getByRole("heading", { level: 2, name: "Матурата е предадена" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Виж резултата" }).getAttribute("href")).toBe("/rezultati/abc");
      expect(screen.getByText(/не могат да се променят/)).toBeTruthy();
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.queryByText("Предаването е окончателно")).toBeNull();
    });

    it("never asks to submit again, so returning to the page cannot send a second submission", () => {
      render(
        <SubmissionReview total={5} unansweredIndexes={[]} status={submitted} onConfirm={vi.fn()} onGoToQuestion={() => undefined} />,
      );

      expect(screen.queryByRole("button", { name: /предай/i })).toBeNull();
    });
  });

  describe("the whole flow, with a page that talks to the server", () => {
    function Page({ send }: { send: () => Promise<void> }) {
      const [status, setStatus] = useState<SubmissionStatus>(reviewing);

      return (
        <SubmissionReview
          total={4}
          unansweredIndexes={[1]}
          status={status}
          onGoToQuestion={() => undefined}
          onConfirm={() => {
            setStatus({ phase: "submitting" });
            send().then(
              () => setStatus({ phase: "submitted", resultHref: "/rezultati/1" }),
              () => setStatus({ phase: "failed", message: "Не успяхме да предадем." }),
            );
          }}
        />
      );
    }

    function deferred() {
      let resolve!: () => void;
      let reject!: (reason: Error) => void;
      const promise = new Promise<void>((done, fail) => {
        resolve = done;
        reject = fail;
      });

      return { promise, resolve, reject };
    }

    /** Lets the page's promise handlers run and React apply the state they set. */
    async function settle(action: () => void) {
      await act(async () => {
        action();
        await Promise.resolve();
      });
    }

    it("goes from review, through submitting, to the result", async () => {
      const user = userEvent.setup();
      const request = deferred();
      const send = vi.fn(() => request.promise);
      render(<Page send={send} />);

      await openConfirmation(user);
      await user.click(screen.getByRole("button", { name: "Да, предай матурата" }));
      expect(screen.getByRole<HTMLButtonElement>("button", { name: "Предаване…" }).disabled).toBe(true);

      await settle(() => request.resolve());

      expect(send).toHaveBeenCalledOnce();
      expect(screen.getByRole("link", { name: "Виж резултата" })).toBeTruthy();
    });

    it("lets the student retry after a failure, and succeeds the second time with one request each", async () => {
      const user = userEvent.setup();
      const first = deferred();
      const second = deferred();
      const send = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      render(<Page send={send} />);

      await openConfirmation(user);
      await user.click(screen.getByRole("button", { name: "Да, предай матурата" }));
      await settle(() => first.reject(new Error("network")));
      expect(screen.getByRole("alert").textContent).toContain("Не успяхме да предадем.");

      await user.click(screen.getByRole("button", { name: "Опитай отново" }));
      await settle(() => second.resolve());

      expect(send).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("link", { name: "Виж резултата" })).toBeTruthy();
    });
  });
});
