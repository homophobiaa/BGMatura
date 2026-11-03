# Exam countdown

`ExamCountdown` shows the time left in an exam attempt. It is a **display only**: the
server owns the deadline and decides whether an answer is on time. Code:
[`ExamCountdown.tsx`](../../src/features/exams/components/ExamCountdown.tsx) and the pure
rules in [`countdown.ts`](../../src/features/exams/countdown.ts).

```tsx
<ExamCountdown
  deadline={attempt.deadline}      // ISO timestamp from the server
  serverNow={attempt.serverNow}    // the server's own time when it produced the deadline
  onExpire={askServerToFinish}     // a prompt, not an authorization
  onResync={refreshDeadline}       // fetch a fresh deadline and server time
/>
```

## How the time is derived

The remaining time is `deadline − serverNow − (time this page has waited since it received
them)`. Both timestamps are the server's, so **the student's own clock being wrong, or changed,
does not matter**. The wait is read from the real clock, never counted in ticks, so a timer
that a background tab slows down or freezes cannot make the display drift: the next read is
always right.

Passing a new `deadline` or `serverNow` starts a fresh count from the moment they arrive. This
is how a resync takes effect.

## Inactive tabs and resuming

Browsers throttle timers in background tabs and stop them on a sleeping device. So:

- The display jumps to the correct time the moment the tab becomes visible again or a page is
  restored from the back-forward cache.
- At the same moments `onResync` is called, so the page can fetch a fresh deadline and server
  time and pass them back in.

## The browser never authorizes anything

Reaching zero only changes the text and calls `onExpire` once, so the page can ask the server to
finish the attempt. The server decides, from its own clock, whether a late answer counts. The
component has no controls and submits nothing. After a resync that is still expired `onExpire`
is called again, so the page must treat it as safe to repeat.

## States and wording

| State | When | Display |
| --- | --- | --- |
| Running | More than 5 minutes left | **Оставащо време** and the time |
| Low | 5 minutes or less | Adds **Остава малко време** with a warning icon, in the `warning` colour |
| Expired | Zero | Shows `00:00` and **Времето изтече** with a clock icon |

Time is `4:00:00` from an hour up and `59:05` below it, rounded up so `00:00` only appears when
the time is really over. Status is text and an icon, never colour alone
([DESIGN.md](../../.claude/DESIGN.md) sections 3 and 7).

## Restrained announcements

The timer element is not a live region, so screen readers are not interrupted every second.
A separate status region speaks the time only at fixed points: 1 hour, 30, 15, 10, 5 and 1
minute left, and when the time is up. If a throttled tab skipped several of these at once, only
the latest is spoken. Nothing is announced when the page first shows the time.

## Placement

The component has no layout of its own. Place it where it stays in view; the design direction
asks for it to be sticky on a phone.

## Tests

`countdown.test.ts` covers the pure rules. `ExamCountdown.test.tsx` runs the component with fake
timers and covers a wrong student clock, a throttled tab, a frozen tab waking up, the states,
the announcements, the expiry prompt, and the clean-up of timers.
