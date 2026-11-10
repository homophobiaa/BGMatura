"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { practiceSessionPath } from "../practice-paths";
import { startPracticeAttempt } from "./practice-api";

/** Starts a new anonymous practice session. Every press after a finished one starts a fresh attempt. */
export function StartPracticeButton({ topicId, label = "Започни упражнение", variant = "default" }: {
  topicId: string; label?: string; variant?: "default" | "secondary";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function start() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const result = await startPracticeAttempt(topicId);
    if (result.ok) {
      router.push(practiceSessionPath(topicId, result.value.id));
      return;
    }
    inFlight.current = false;
    setBusy(false);
    setError(result.message);
  }

  return <div className="space-y-3">
    <Button type="button" variant={variant} busy={busy} onClick={() => { void start(); }}>{label}</Button>
    {error && <Feedback tone="error">{error}</Feedback>}
  </div>;
}
