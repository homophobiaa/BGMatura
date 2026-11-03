"use client";

import { createAuthClient } from "better-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";

const authClient = createAuthClient();

export function AdminAuthControl({ mode }: { mode: "login" | "logout" }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit() {
    setBusy(true);
    setFailed(false);
    try {
      if (mode === "login") {
        const result = await authClient.signIn.social({ provider: "google", callbackURL: "/admin", errorCallbackURL: "/admin/sign-in?error=access-denied" });
        if (result.error) { setFailed(true); setBusy(false); }
      } else {
        const result = await authClient.signOut();
        if (result.error) { setFailed(true); setBusy(false); }
        else window.location.assign("/admin/sign-in");
      }
    } catch { setFailed(true); setBusy(false); }
  }

  return <div className="space-y-4">
    <Button type="button" busy={busy} onClick={() => { void submit(); }}>{mode === "login" ? "Вход с Google" : "Изход"}</Button>
    {failed && <Feedback tone="error">Неуспешен вход или изход. Опитай отново.</Feedback>}
  </div>;
}
