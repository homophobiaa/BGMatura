// @vitest-environment jsdom

import "@/test-support/dom";

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExamCountdown } from "./ExamCountdown";

const MINUTE = 60_000;
const SERVER_NOW = "2026-11-03T08:00:00.000Z";

function deadlineIn(milliseconds: number): string {
  return new Date(Date.parse(SERVER_NOW) + milliseconds).toISOString();
}

function timer(): HTMLElement {
  return screen.getByRole("timer");
}

function announcement(): string {
  return screen.getByRole("status").textContent ?? "";
}

function tick(milliseconds: number) {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

/** Moves the browser's clock forward without running any timers, as a frozen background tab would. */
function freezeClockFor(milliseconds: number) {
  vi.setSystemTime(Date.now() + milliseconds);
}

function wakeUp() {
  act(() => {
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  // The student's own clock is deliberately far from the server's.
  vi.setSystemTime(new Date("2001-02-03T04:05:06.000Z"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ExamCountdown", () => {
  describe("showing the time", () => {
    it("labels the time and shows what the server says is left", () => {
      render(<ExamCountdown deadline={deadlineIn(240 * MINUTE)} serverNow={SERVER_NOW} />);

      expect(screen.getByText("Оставащо време")).toBeTruthy();
      expect(timer().textContent).toBe("4:00:00");
      expect(timer().getAttribute("datetime")).toBe("PT4H0M0S");
    });

    it("does not depend on the student's own clock", () => {
      vi.setSystemTime(new Date("2035-12-31T23:59:59.000Z"));
      render(<ExamCountdown deadline={deadlineIn(90 * MINUTE)} serverNow={SERVER_NOW} />);

      expect(timer().textContent).toBe("1:30:00");
    });

    it("counts down every second", () => {
      render(<ExamCountdown deadline={deadlineIn(61 * MINUTE)} serverNow={SERVER_NOW} />);

      tick(1000);
      expect(timer().textContent).toBe("1:00:59");

      tick(59_000);
      expect(timer().textContent).toBe("1:00:00");

      tick(MINUTE);
      expect(timer().textContent).toBe("59:00");
    });

    it("starts a fresh count when the server sends a new deadline and time", () => {
      const { rerender } = render(<ExamCountdown deadline={deadlineIn(60 * MINUTE)} serverNow={SERVER_NOW} />);
      tick(10 * MINUTE);
      expect(timer().textContent).toBe("50:00");

      const later = new Date(Date.parse(SERVER_NOW) + 10 * MINUTE + 3000).toISOString();
      rerender(<ExamCountdown deadline={deadlineIn(60 * MINUTE)} serverNow={later} />);

      expect(timer().textContent).toBe("49:57");
    });

    it("is not fooled by a reading an earlier countdown left behind, even if the clock moved back", () => {
      const first = render(<ExamCountdown deadline={deadlineIn(240 * MINUTE)} serverNow={SERVER_NOW} />);
      freezeClockFor(100 * MINUTE);
      tick(1000);
      first.unmount();

      vi.setSystemTime(new Date("2001-02-03T04:05:06.000Z"));
      const onExpire = vi.fn();
      render(<ExamCountdown deadline={deadlineIn(60 * MINUTE)} serverNow={SERVER_NOW} onExpire={onExpire} />);

      expect(timer().textContent).toBe("1:00:00");
      expect(screen.queryByText("Времето изтече")).toBeNull();
      expect(onExpire).not.toHaveBeenCalled();
    });

    it("does not stack timers or listeners after it is removed", () => {
      const { unmount } = render(<ExamCountdown deadline={deadlineIn(60 * MINUTE)} serverNow={SERVER_NOW} />);
      expect(vi.getTimerCount()).toBeGreaterThan(0);

      unmount();

      expect(vi.getTimerCount()).toBe(0);
    });

    it("shows several countdowns from one shared clock", () => {
      render(
        <>
          <ExamCountdown deadline={deadlineIn(60 * MINUTE)} serverNow={SERVER_NOW} />
          <ExamCountdown deadline={deadlineIn(30 * MINUTE)} serverNow={SERVER_NOW} />
        </>,
      );

      tick(1000);

      expect(screen.getAllByRole("timer").map((element) => element.textContent)).toEqual(["59:59", "29:59"]);
      expect(vi.getTimerCount()).toBe(1);
    });
  });

  describe("an inactive tab", () => {
    it("shows the right time again at once after a frozen tab wakes up", () => {
      const onResync = vi.fn();
      render(<ExamCountdown deadline={deadlineIn(60 * MINUTE)} serverNow={SERVER_NOW} onResync={onResync} />);

      freezeClockFor(10 * MINUTE);
      expect(timer().textContent).toBe("1:00:00");

      wakeUp();

      expect(timer().textContent).toBe("50:00");
      expect(onResync).toHaveBeenCalledOnce();
    });

    it("catches up when a throttled timer finally fires", () => {
      render(<ExamCountdown deadline={deadlineIn(60 * MINUTE)} serverNow={SERVER_NOW} />);

      // The browser ran one late tick after ten minutes, instead of 600 ticks.
      freezeClockFor(10 * MINUTE - 1000);
      tick(1000);

      expect(timer().textContent).toBe("50:00");
    });

    it("asks the page to resynchronize whenever the tab becomes visible again", () => {
      const onResync = vi.fn();
      render(<ExamCountdown deadline={deadlineIn(60 * MINUTE)} serverNow={SERVER_NOW} onResync={onResync} />);

      wakeUp();
      wakeUp();

      expect(onResync).toHaveBeenCalledTimes(2);
    });

    it("does not resynchronize while the tab is hidden", () => {
      const onResync = vi.fn();
      render(<ExamCountdown deadline={deadlineIn(60 * MINUTE)} serverNow={SERVER_NOW} onResync={onResync} />);

      act(() => {
        Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
      });

      expect(onResync).not.toHaveBeenCalled();
    });

    it("asks the page to resynchronize when a page is restored from the back-forward cache", () => {
      const onResync = vi.fn();
      render(<ExamCountdown deadline={deadlineIn(60 * MINUTE)} serverNow={SERVER_NOW} onResync={onResync} />);

      act(() => {
        window.dispatchEvent(new Event("pageshow"));
      });

      expect(onResync).toHaveBeenCalledOnce();
    });
  });

  describe("low time and expiry", () => {
    it("shows nothing extra while there is plenty of time", () => {
      render(<ExamCountdown deadline={deadlineIn(6 * MINUTE)} serverNow={SERVER_NOW} />);

      expect(screen.queryByText("Остава малко време")).toBeNull();
      expect(screen.queryByText("Времето изтече")).toBeNull();
    });

    it("says in text, with an icon, that time is running low in the last five minutes", () => {
      render(<ExamCountdown deadline={deadlineIn(6 * MINUTE)} serverNow={SERVER_NOW} />);

      tick(MINUTE);

      const warning = screen.getByText("Остава малко време");
      expect(timer().textContent).toBe("05:00");
      expect(warning.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
      expect(warning.className).toContain("text-warning");
    });

    it("says in text that the time is over, and prompts the page once", () => {
      const onExpire = vi.fn();
      render(<ExamCountdown deadline={deadlineIn(2000)} serverNow={SERVER_NOW} onExpire={onExpire} />);
      expect(onExpire).not.toHaveBeenCalled();

      tick(3000);
      tick(5000);

      expect(timer().textContent).toBe("00:00");
      expect(screen.getByText("Времето изтече")).toBeTruthy();
      expect(screen.queryByText("Остава малко време")).toBeNull();
      expect(onExpire).toHaveBeenCalledOnce();
    });

    it("prompts the page straight away when the deadline has already passed", () => {
      const onExpire = vi.fn();
      render(<ExamCountdown deadline={deadlineIn(-MINUTE)} serverNow={SERVER_NOW} onExpire={onExpire} />);

      expect(timer().textContent).toBe("00:00");
      expect(screen.getByText("Времето изтече")).toBeTruthy();
      expect(onExpire).toHaveBeenCalledOnce();
    });

    it("never counts below zero", () => {
      render(<ExamCountdown deadline={deadlineIn(1000)} serverNow={SERVER_NOW} />);

      tick(60_000);

      expect(timer().textContent).toBe("00:00");
    });

    it("only displays; reaching zero changes nothing but the text and the prompt", () => {
      const onExpire = vi.fn();
      const { container } = render(
        <ExamCountdown deadline={deadlineIn(1000)} serverNow={SERVER_NOW} onExpire={onExpire} />,
      );

      tick(2000);

      expect(container.querySelectorAll("button, input, form, a")).toHaveLength(0);
    });
  });

  describe("restrained announcements", () => {
    it("announces nothing when the page first shows the time", () => {
      render(<ExamCountdown deadline={deadlineIn(240 * MINUTE)} serverNow={SERVER_NOW} />);

      expect(announcement()).toBe("");
    });

    it("does not make the timer itself a live region", () => {
      render(<ExamCountdown deadline={deadlineIn(240 * MINUTE)} serverNow={SERVER_NOW} />);

      expect(["polite", "assertive"]).not.toContain(timer().getAttribute("aria-live"));
      expect(timer().closest("[aria-live]")).toBeNull();
    });

    it("speaks the time at fixed points, not every second", () => {
      render(<ExamCountdown deadline={deadlineIn(31 * MINUTE)} serverNow={SERVER_NOW} />);
      const spoken: string[] = [];

      for (let second = 0; second < 31 * 60; second += 1) {
        tick(1000);
        if (announcement() !== (spoken.at(-1) ?? "")) {
          spoken.push(announcement());
        }
      }

      expect(spoken).toEqual([
        "Остават 30 минути.",
        "Остават 15 минути.",
        "Остават 10 минути.",
        "Остават 5 минути.",
        "Остава 1 минута.",
        "Времето изтече.",
      ]);
      // A whole 31-minute exam tail is simulated second by second, about 1,900 renders, which is slower than the default limit.
    }, 30_000);

    it("announces only the latest milestone when a throttled tab skipped several", () => {
      render(<ExamCountdown deadline={deadlineIn(31 * MINUTE)} serverNow={SERVER_NOW} />);

      freezeClockFor(27 * MINUTE);
      tick(1000);

      expect(timer().textContent).toBe("03:59");
      expect(announcement()).toBe("Остават 5 минути.");
    });

    it("announces expiry", () => {
      render(<ExamCountdown deadline={deadlineIn(1000)} serverNow={SERVER_NOW} />);

      tick(2000);

      expect(announcement()).toBe("Времето изтече.");
    });
  });
});
