import "server-only";

export function hasExpired(deadline: Date | null, now: Date): boolean {
  return deadline !== null && now >= deadline;
}

export function remainingSeconds(deadline: Date | null, now: Date): number | null {
  if (deadline === null) return null;
  return Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 1000));
}
