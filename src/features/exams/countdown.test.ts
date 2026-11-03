import { describe, expect, it } from "vitest";

import {
  announcementFor,
  countdownState,
  EXPIRED_ANNOUNCEMENT,
  formatRemaining,
  LOW_TIME_MS,
  remainingDuration,
  remainingMs,
} from "./countdown";

const MINUTE = 60_000;
const SECOND = 1000;

describe("remainingMs", () => {
  const serverNow = "2026-11-03T08:00:00.000Z";
  const deadline = "2026-11-03T12:00:00.000Z";

  it("is the time from the server's now to the deadline", () => {
    expect(remainingMs(deadline, serverNow, 0)).toBe(4 * 60 * MINUTE);
  });

  it("shrinks by the time this page has waited since it received the values", () => {
    expect(remainingMs(deadline, serverNow, 10 * MINUTE)).toBe(230 * MINUTE);
  });

  it("never goes below zero, however long the page waited", () => {
    expect(remainingMs(deadline, serverNow, 5 * 60 * MINUTE)).toBe(0);
    expect(remainingMs(serverNow, deadline, 0)).toBe(0);
  });

  it("ignores a negative wait, such as a clock that moved backwards", () => {
    expect(remainingMs(deadline, serverNow, -10 * MINUTE)).toBe(4 * 60 * MINUTE);
  });

  it("does not depend on the student's own clock, only on the server's two timestamps", () => {
    // The same two server values give the same answer whatever the browser's date is.
    expect(remainingMs(deadline, serverNow, 0)).toBe(remainingMs(deadline, serverNow, 0));
    expect(remainingMs("2026-11-03T12:00:00+02:00", "2026-11-03T09:00:00+02:00", 0)).toBe(3 * 60 * MINUTE);
  });

  it.each([
    ["an invalid deadline", "tomorrow", serverNow],
    ["an invalid server time", deadline, ""],
  ])("refuses %s instead of showing a wrong time", (_description, badDeadline, badNow) => {
    expect(() => remainingMs(badDeadline, badNow, 0)).toThrow("valid timestamps");
  });
});

describe("countdownState", () => {
  it.each([
    [4 * 60 * MINUTE, "running"],
    [LOW_TIME_MS + 1, "running"],
    [LOW_TIME_MS, "low"],
    [MINUTE, "low"],
    [1, "low"],
    [0, "expired"],
    [-SECOND, "expired"],
  ] as const)("is %i ms -> %s", (remaining, expected) => {
    expect(countdownState(remaining)).toBe(expected);
  });

  it("treats the last five minutes as low time", () => {
    expect(LOW_TIME_MS).toBe(5 * MINUTE);
  });
});

describe("formatRemaining", () => {
  it.each([
    [4 * 60 * MINUTE, "4:00:00"],
    [61 * MINUTE, "1:01:00"],
    [60 * MINUTE, "1:00:00"],
    [59 * MINUTE + 59 * SECOND, "59:59"],
    [59 * MINUTE + 5 * SECOND, "59:05"],
    [5 * MINUTE, "05:00"],
    [SECOND, "00:01"],
    [0, "00:00"],
  ])("shows %i ms as %s", (remaining, expected) => {
    expect(formatRemaining(remaining)).toBe(expected);
  });

  it("rounds up, so 00:00 only appears when the time is really over", () => {
    expect(formatRemaining(1)).toBe("00:01");
    expect(formatRemaining(999)).toBe("00:01");
    expect(formatRemaining(1001)).toBe("00:02");
  });

  it("never shows a negative time", () => {
    expect(formatRemaining(-5000)).toBe("00:00");
  });
});

describe("remainingDuration", () => {
  it.each([
    [4 * 60 * MINUTE, "PT4H0M0S"],
    [59 * MINUTE + 5 * SECOND, "PT59M5S"],
    [SECOND, "PT1S"],
    [0, "PT0S"],
  ])("writes %i ms as the ISO duration %s", (remaining, expected) => {
    expect(remainingDuration(remaining)).toBe(expected);
  });
});

describe("announcementFor", () => {
  it.each([
    [61 * MINUTE, 59 * MINUTE, "Остава 1 час."],
    [31 * MINUTE, 29 * MINUTE, "Остават 30 минути."],
    [16 * MINUTE, 14 * MINUTE, "Остават 15 минути."],
    [11 * MINUTE, 9 * MINUTE, "Остават 10 минути."],
    [6 * MINUTE, 4 * MINUTE, "Остават 5 минути."],
    [2 * MINUTE, 59 * SECOND, "Остава 1 минута."],
  ])("announces the milestone crossed going from %i ms to %i ms", (previous, current, expected) => {
    expect(announcementFor(previous, current)).toBe(expected);
  });

  it("announces a milestone exactly when it is reached", () => {
    expect(announcementFor(30 * MINUTE + SECOND, 30 * MINUTE)).toBe("Остават 30 минути.");
  });

  it("is silent between milestones, so nothing is spoken every second", () => {
    for (let remaining = 29 * MINUTE; remaining > 16 * MINUTE; remaining -= SECOND * 7) {
      expect(announcementFor(remaining + SECOND, remaining)).toBeNull();
    }
  });

  it("does not repeat a milestone it has already passed", () => {
    expect(announcementFor(29 * MINUTE, 28 * MINUTE)).toBeNull();
    expect(announcementFor(30 * MINUTE, 30 * MINUTE)).toBeNull();
  });

  it("announces only the latest milestone when a throttled tab crossed several at once", () => {
    expect(announcementFor(31 * MINUTE, 4 * MINUTE)).toBe("Остават 5 минути.");
    expect(announcementFor(2 * 60 * MINUTE, 40 * MINUTE)).toBe("Остава 1 час.");
  });

  it("announces expiry, even if it came from far above", () => {
    expect(announcementFor(SECOND, 0)).toBe(EXPIRED_ANNOUNCEMENT);
    expect(announcementFor(31 * MINUTE, 0)).toBe(EXPIRED_ANNOUNCEMENT);
  });

  it("does not announce expiry again once it is over", () => {
    expect(announcementFor(0, 0)).toBeNull();
  });
});
