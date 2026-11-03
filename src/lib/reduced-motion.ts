import { useSyncExternalStore } from "react";

/**
 * The one reduced-motion check for scripted motion. CSS uses `motion-safe:` / `motion-reduce:`
 * or `@media (prefers-reduced-motion: ...)` instead. Wherever the preference cannot be read
 * (on the server, before hydration, or in a browser without `matchMedia`), the answer is
 * "reduce": the calm version is the safe default, and motion is only added once it is known
 * to be welcome. Policy: `.claude/DESIGN.md`, section 10.
 */
export const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function motionPreference(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(reducedMotionQuery);
}

/** For event handlers and scripted motion outside React rendering. */
export function prefersReducedMotion(): boolean {
  return motionPreference()?.matches ?? true;
}

/** Calls `listener` whenever the preference changes, for example in the operating system settings. */
export function subscribeToReducedMotion(listener: () => void): () => void {
  const preference = motionPreference();
  if (!preference) return () => {};
  preference.addEventListener("change", listener);
  return () => preference.removeEventListener("change", listener);
}

function reducedOnServer(): boolean {
  return true;
}

/** True when motion should be reduced. Re-renders when the preference changes. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeToReducedMotion, prefersReducedMotion, reducedOnServer);
}
