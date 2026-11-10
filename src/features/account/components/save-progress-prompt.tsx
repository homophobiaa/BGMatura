"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const dismissedKey = "bgm-save-progress-dismissed";

type Who = "unknown" | "visitor" | "student";

function wasDismissed() {
  try { return window.sessionStorage.getItem(dismissedKey) === "1"; } catch { return false; }
}

function rememberDismissal() {
  try { window.sessionStorage.setItem(dismissedKey, "1"); } catch { /* the prompt just comes back on the next page */ }
}

/**
 * Shown under a finished result. A visitor without an account is offered, calmly, to sign in and keep the result.
 * It is a plain section, not a dialog: it never covers the result, takes focus, animates or repeats after "Не сега"
 * (remembered for this browser session only). Signed-in students never see it; for them the finished attempt is
 * linked to the account instead (a no-op when it already is), so signing in from this very prompt keeps the result.
 * Anything unexpected (sign-in unavailable, no network) shows nothing: the result itself never depends on this.
 */
export function SaveProgressPrompt({ attemptId, returnTo }: { attemptId: string; returnTo: string }) {
  const [who, setWho] = useState<Who>("unknown");
  // Nothing is rendered until the account is known, so reading storage on first render cannot cause a mismatch.
  const [dismissed, setDismissed] = useState(wasDismissed);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/account/me", { credentials: "same-origin" });
        if (!response.ok) return;
        const body = (await response.json()) as { user: unknown };
        if (!active) return;
        if (body.user === null) { setWho("visitor"); return; }
        setWho("student");
        await fetch(`/api/attempts/${encodeURIComponent(attemptId)}`, {
          method: "POST", credentials: "same-origin",
          headers: { "content-type": "application/json" }, body: JSON.stringify({ operation: "claim" }),
        });
      } catch { /* nothing to show, nothing to break */ }
    }
    void load();
    return () => { active = false; };
  }, [attemptId]);

  if (who !== "visitor" || dismissed) return null;

  return (
    <section aria-labelledby="save-progress-title" className="space-y-3 rounded-lg bg-surface-card p-4 md:p-6">
      <h2 id="save-progress-title" className="text-title">Запази прогреса</h2>
      <p>
        Резултатът остава достъпен в този браузър и без профил. Ако влезеш с Google, ще го виждаш и от други устройства, заедно с цялата си история.
        Пазим само името и имейла от Google.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild><Link href={`/vhod?next=${encodeURIComponent(returnTo)}`}>Влез и запази</Link></Button>
        <Button type="button" variant="secondary" onClick={() => { rememberDismissal(); setDismissed(true); }}>Не сега</Button>
      </div>
    </section>
  );
}
