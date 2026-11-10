"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";

/** Two steps, so a profile is never deleted by one stray press: ask, then confirm. Nothing depends on motion. */
export function DeleteAccountControl() {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function remove() {
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: true }),
      });
      if (!response.ok) throw new Error("failed");
      window.location.assign("/?profil=izbrisan");
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  if (!asking) return <Button type="button" variant="secondary" onClick={() => setAsking(true)}>Изтрий профила и данните ми</Button>;

  return (
    <div role="group" aria-labelledby="delete-title" className="space-y-4 rounded-lg border border-hairline p-4">
      <p id="delete-title" className="font-semibold">Сигурен ли си?</p>
      <p>Профилът ти, входът ти и всички запазени резултати ще бъдат изтрити завинаги. Това не може да се върне. Уроците и упражненията остават достъпни без профил.</p>
      <div className="flex flex-wrap gap-3">
        <Button type="button" busy={busy} onClick={() => { void remove(); }}>Да, изтрий всичко</Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => setAsking(false)}>Отказ</Button>
      </div>
      {failed ? <Feedback tone="error">Профилът не беше изтрит. Опитай отново.</Feedback> : null}
    </div>
  );
}
