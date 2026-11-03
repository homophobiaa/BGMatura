/**
 * Pure countdown rules. The deadline belongs to the server; the browser only shows how much
 * time is left and never decides what happens when it runs out.
 */

/** From this point on the countdown is shown as low on time (design direction: last 5 minutes). */
export const LOW_TIME_MS = 5 * 60 * 1000;

export type CountdownState = "running" | "low" | "expired";

/**
 * Time left according to the server, in milliseconds. `serverNow` is the server's own time when
 * it produced the deadline, so the result does not depend on whether the student's clock is
 * right. `elapsedSinceSyncMs` is how long this page has been waiting since it received those two
 * values.
 */
export function remainingMs(deadline: string, serverNow: string, elapsedSinceSyncMs: number): number {
  const untilDeadline = Date.parse(deadline) - Date.parse(serverNow);

  if (Number.isNaN(untilDeadline)) {
    throw new Error("The exam deadline and the server time must be valid timestamps.");
  }

  return Math.max(0, untilDeadline - Math.max(0, elapsedSinceSyncMs));
}

export function countdownState(remaining: number): CountdownState {
  if (remaining <= 0) {
    return "expired";
  }

  return remaining <= LOW_TIME_MS ? "low" : "running";
}

function secondsLeft(remaining: number): number {
  // Round up so the last second still shows 00:01 and 00:00 means the time is really over.
  return Math.ceil(Math.max(0, remaining) / 1000);
}

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

/** `4:00:00` for an hour or more, `59:05` below an hour. */
export function formatRemaining(remaining: number): string {
  const total = secondsLeft(remaining);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  return hours > 0 ? `${hours}:${twoDigits(minutes)}:${twoDigits(seconds)}` : `${twoDigits(minutes)}:${twoDigits(seconds)}`;
}

/** The value of the `datetime` attribute, as an ISO 8601 duration such as `PT59M05S`. */
export function remainingDuration(remaining: number): string {
  const total = secondsLeft(remaining);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  return `PT${hours > 0 ? `${hours}H` : ""}${hours > 0 || minutes > 0 ? `${minutes}M` : ""}${seconds}S`;
}

/**
 * Screen readers are told the time at a few fixed points instead of every second, which would
 * make the exam impossible to concentrate on. Milestones are in minutes.
 */
const ANNOUNCEMENTS = [
  { minutes: 60, text: "Остава 1 час." },
  { minutes: 30, text: "Остават 30 минути." },
  { minutes: 15, text: "Остават 15 минути." },
  { minutes: 10, text: "Остават 10 минути." },
  { minutes: 5, text: "Остават 5 минути." },
  { minutes: 1, text: "Остава 1 минута." },
] as const;

export const EXPIRED_ANNOUNCEMENT = "Времето изтече.";

/**
 * What to announce when the time moved from `previous` to `current`, or `null` for nothing. If a
 * background tab was throttled and several milestones were crossed at once, only the most recent
 * one is announced. Expiry is always announced.
 */
export function announcementFor(previous: number, current: number): string | null {
  if (previous > 0 && current <= 0) {
    return EXPIRED_ANNOUNCEMENT;
  }

  const crossed = ANNOUNCEMENTS.filter(
    (milestone) => previous > milestone.minutes * 60_000 && current <= milestone.minutes * 60_000 && current > 0,
  );

  return crossed.at(-1)?.text ?? null;
}
