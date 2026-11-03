"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  announcementFor,
  countdownState,
  formatRemaining,
  remainingDuration,
  remainingMs,
} from "../countdown";
import { ClockIcon, TriangleAlertIcon } from "./status-icons";

export interface ExamCountdownProps {
  /** When the attempt ends, as an ISO timestamp. It comes from the server and is never computed here. */
  readonly deadline: string;
  /** The server's own time when it produced `deadline`. Pass fresh values after a resync. */
  readonly serverNow: string;
  /**
   * Called once when the time reaches zero, so the page can ask the server to finish the attempt.
   * This is only a prompt: the server decides, from its own clock, whether an answer is on time.
   * After a resync that is still expired it is called again, so the page must treat it as repeatable.
   */
  readonly onExpire?: () => void;
  /**
   * Called when the page becomes visible or the browser resumes, because timers in a background tab
   * or a sleeping device cannot be trusted. The page should fetch a fresh deadline and server time
   * and pass them back in.
   */
  readonly onResync?: () => void;
}

const TICK_MS = 1000;

/**
 * A shared clock for every countdown on the page. Components read the real time from it, so a
 * throttled timer in a background tab cannot make the display drift: the next read is always right.
 */
let latestNow = 0;
const listeners = new Set<() => void>();
let timer: number | undefined;

function refreshClock() {
  latestNow = Date.now();
  listeners.forEach((listener) => listener());
}

function refreshWhenVisible() {
  if (document.visibilityState === "visible") {
    refreshClock();
  }
}

function subscribeToClock(listener: () => void) {
  listeners.add(listener);

  if (listeners.size === 1) {
    timer = window.setInterval(refreshClock, TICK_MS);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("pageshow", refreshClock);
  }

  // React reads the snapshot again after subscribing, so a stale value is corrected at once.
  latestNow = Date.now();

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("pageshow", refreshClock);
    }
  };
}

// With no countdown subscribed the stored reading is stale, so it is reported as 0, meaning "no time
// has passed yet". A countdown rendering before it subscribes therefore never sees a reading from
// an earlier mount, which could otherwise make it look expired and prompt the page wrongly.
const getClock = () => (listeners.size === 0 ? 0 : latestNow);
// Rendering on the server, and hydrating, assume no time has passed since the server sent the deadline.
const getServerClock = () => 0;

/**
 * The time left in the exam. It counts from a server-derived deadline, shows the right time again
 * at once when a background tab wakes up, and tells screen readers the time only at a few fixed
 * points (see `announcementFor`). It is only a display: it never authorizes or rejects an answer.
 *
 * Place it so it stays in view, for example sticky at the top on a phone.
 */
export function ExamCountdown(props: ExamCountdownProps) {
  // New values from the server start a fresh count from the moment they arrive.
  return <CountdownDisplay key={`${props.deadline}|${props.serverNow}`} {...props} />;
}

function CountdownDisplay({ deadline, serverNow, onExpire, onResync }: ExamCountdownProps) {
  const [syncedAt] = useState(() => Date.now());
  const now = useSyncExternalStore(subscribeToClock, getClock, getServerClock);
  const remaining = remainingMs(deadline, serverNow, now - syncedAt);
  const state = countdownState(remaining);

  // Remember the last announcement, and update it while rendering when a milestone is crossed.
  const [tracked, setTracked] = useState({ remaining, announcement: "" });

  if (tracked.remaining !== remaining) {
    setTracked({
      remaining,
      announcement: announcementFor(tracked.remaining, remaining) ?? tracked.announcement,
    });
  }

  const expireReported = useRef(false);
  const onExpireRef = useRef(onExpire);
  const onResyncRef = useRef(onResync);

  useEffect(() => {
    onExpireRef.current = onExpire;
    onResyncRef.current = onResync;
  });

  useEffect(() => {
    if (remaining <= 0 && !expireReported.current) {
      expireReported.current = true;
      onExpireRef.current?.();
    }
  }, [remaining]);

  useEffect(() => {
    const resume = () => onResyncRef.current?.();
    const resumeWhenVisible = () => {
      if (document.visibilityState === "visible") {
        resume();
      }
    };

    document.addEventListener("visibilitychange", resumeWhenVisible);
    window.addEventListener("pageshow", resume);

    return () => {
      document.removeEventListener("visibilitychange", resumeWhenVisible);
      window.removeEventListener("pageshow", resume);
    };
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="text-label text-muted">Оставащо време</span>
      <time dateTime={remainingDuration(remaining)} role="timer" className="text-title text-ink tabular-nums">
        {formatRemaining(remaining)}
      </time>
      {state === "low" ? (
        <span className="flex items-center gap-1 text-label text-warning">
          <TriangleAlertIcon />
          Остава малко време
        </span>
      ) : null}
      {state === "expired" ? (
        <span className="flex items-center gap-1 text-label text-warning">
          <ClockIcon />
          Времето изтече
        </span>
      ) : null}
      {/* Spoken only at fixed points, never every second. */}
      <p role="status" className="sr-only">
        {tracked.announcement}
      </p>
    </div>
  );
}
