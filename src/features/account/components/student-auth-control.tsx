"use client";

import { createAuthClient } from "better-auth/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";

const authClient = createAuthClient();

/**
 * The one button of the sign-in and registration page. With Google sign-in the first sign-in creates the account,
 * so signing in and registering are the same step. `returnTo` is a path on this site that the server page has
 * already checked with `safeReturnPath`.
 */
export function StudentAuthControl({ mode, returnTo }: { mode: "login" | "logout"; returnTo: string }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit() {
    setBusy(true);
    setFailed(false);

    try {
      if (mode === "login") {
        const result = await authClient.signIn.social({
          provider: "google",
          callbackURL: returnTo,
          errorCallbackURL: "/vhod?error=sign-in",
        });
        if (result.error) { setFailed(true); setBusy(false); }
      } else {
        const result = await authClient.signOut();
        if (result.error) { setFailed(true); setBusy(false); }
        else window.location.assign(returnTo);
      }
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button type="button" busy={busy} onClick={() => { void submit(); }}>
        {mode === "login" ? "Вход или регистрация с Google" : "Изход"}
      </Button>
      {failed ? <Feedback tone="error">Нещо се обърка. Опитай отново.</Feedback> : null}
    </div>
  );
}
