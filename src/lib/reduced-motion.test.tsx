// @vitest-environment jsdom

import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { installMatchMedia } from "@/test-support/match-media";

import { prefersReducedMotion, reducedMotionQuery, subscribeToReducedMotion, usePrefersReducedMotion } from "./reduced-motion";

let media: ReturnType<typeof installMatchMedia> | undefined;

afterEach(() => {
  cleanup();
  media?.uninstall();
  media = undefined;
});

describe("prefersReducedMotion", () => {
  it("asks the browser for the prefers-reduced-motion: reduce query", () => {
    expect(reducedMotionQuery).toBe("(prefers-reduced-motion: reduce)");
  });

  it("follows the browser preference", () => {
    media = installMatchMedia({ [reducedMotionQuery]: true });
    expect(prefersReducedMotion()).toBe(true);
    media.setMatches(reducedMotionQuery, false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("reduces motion when the browser cannot report a preference", () => {
    expect(typeof window.matchMedia).toBe("undefined");
    expect(prefersReducedMotion()).toBe(true);
  });
});

describe("subscribeToReducedMotion", () => {
  it("notifies about changes until unsubscribed", () => {
    media = installMatchMedia({ [reducedMotionQuery]: false });
    let calls = 0;
    const unsubscribe = subscribeToReducedMotion(() => { calls += 1; });
    media.setMatches(reducedMotionQuery, true);
    expect(calls).toBe(1);
    unsubscribe();
    expect(media.listenerCount(reducedMotionQuery)).toBe(0);
    media.setMatches(reducedMotionQuery, false);
    expect(calls).toBe(1);
  });

  it("does nothing, and fails nothing, without matchMedia", () => {
    expect(() => subscribeToReducedMotion(() => {})()).not.toThrow();
  });
});

describe("usePrefersReducedMotion", () => {
  it("returns the current preference and updates when it changes", () => {
    media = installMatchMedia({ [reducedMotionQuery]: false });
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
    act(() => media?.setMatches(reducedMotionQuery, true));
    expect(result.current).toBe(true);
    act(() => media?.setMatches(reducedMotionQuery, false));
    expect(result.current).toBe(false);
  });

  it("stops listening when the component unmounts", () => {
    media = installMatchMedia({ [reducedMotionQuery]: false });
    const { unmount } = renderHook(() => usePrefersReducedMotion());
    expect(media.listenerCount(reducedMotionQuery)).toBe(1);
    unmount();
    expect(media.listenerCount(reducedMotionQuery)).toBe(0);
  });

  function MotionProbe() {
    return <p>{usePrefersReducedMotion() ? "спокойно" : "движение"}</p>;
  }

  it("renders the reduced version on the server, before the preference is known", () => {
    media = installMatchMedia({ [reducedMotionQuery]: false });
    expect(renderToString(<MotionProbe />)).toContain("спокойно");
  });

  it("uses the real preference when rendered in the browser", () => {
    media = installMatchMedia({ [reducedMotionQuery]: false });
    render(<MotionProbe />);
    expect(screen.getByText("движение")).toBeTruthy();
  });
});
