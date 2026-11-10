"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import type { LearningKind } from "@/features/learning/kinds";
import { sendEditorialCommand } from "./editorial-request";

const deletedSchema = z.object({ id: z.uuid(), slug: z.string(), deleted: z.literal(true) });

/**
 * Deletes an unused draft after the editor types its slug. On success the list
 * reloads at `afterDeleteHref`, which keeps the current filters.
 */
export function DeleteRecordControl({ kind, id, slug, title, editHref, afterDeleteHref }: {
  kind: LearningKind; id: string; slug: string; title: string; editHref: string; afterDeleteHref: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ code: string; message: string } | null>(null);
  const inFlight = useRef(false);
  const inputId = `delete-${id}`;

  async function remove() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    const result = await sendEditorialCommand(kind, { operation: "delete", id, confirmation }, deletedSchema);
    if (result.ok) {
      router.replace(afterDeleteHref);
      router.refresh();
      return;
    }
    inFlight.current = false;
    setBusy(false);
    setProblem({ code: result.error, message: result.message });
  }

  if (!open) return <Button type="button" variant="secondary" onClick={() => setOpen(true)} aria-label={`Изтрий „${title}“`}>Изтрий</Button>;

  return <div role="group" aria-label={`Изтриване на „${title}“`} className="w-full space-y-3 rounded-lg bg-surface-soft p-4">
    <label htmlFor={inputId} className="block text-label">Изтриването е окончателно. Въведи адреса <strong>{slug}</strong>, за да потвърдиш.</label>
    <Input id={inputId} value={confirmation} autoComplete="off" spellCheck={false} onChange={(event) => setConfirmation(event.target.value)} />
    {problem && <Feedback tone="error">
      {problem.message}
      {(problem.code === "linked" || problem.code === "unpublish-required") &&
        <> <Link href={editHref} className="text-primary underline underline-offset-4">Отвори записа</Link>, за да го свалиш от публикация или да провериш връзките.</>}
    </Feedback>}
    <div className="flex flex-wrap gap-3">
      <Button type="button" busy={busy} disabled={confirmation !== slug} onClick={() => { void remove(); }}>Изтрий окончателно</Button>
      <Button type="button" variant="secondary" disabled={busy} onClick={() => { setOpen(false); setConfirmation(""); setProblem(null); }}>Откажи</Button>
    </div>
  </div>;
}
