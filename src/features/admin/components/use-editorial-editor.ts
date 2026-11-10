"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { editorialEditPath, type EditorialKind } from "../learning-kind-labels";
import { savedRecordSchema, sendEditorialCommand, type SavedRecord } from "./editorial-request";

export type EditorFeedback = { tone: "success" | "error" | "warning"; text: string };

export type EditorialEditorState = {
  kind: EditorialKind;
  id: string | undefined;
  status: SavedRecord["status"];
  busy: boolean;
  dirty: boolean;
  feedback: EditorFeedback | null;
  fields: Record<string, string[]>;
  markDirty: () => void;
  save: (draft: Record<string, unknown>) => Promise<void>;
  setPublication: (publish: boolean) => Promise<void>;
};

/**
 * Owns one editor's save/publish state. The server is the authority: the hook only
 * sends commands, keeps the last saved version for conflict checks, and blocks a
 * second command while one is still running.
 */
export function useEditorialEditor(kind: EditorialKind, initial: { id?: string; status?: SavedRecord["status"]; updatedAt?: string }): EditorialEditorState {
  const router = useRouter();
  const [status, setStatus] = useState(initial.status ?? "DRAFT");
  const [updatedAt, setUpdatedAt] = useState(initial.updatedAt);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState<EditorFeedback | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const inFlight = useRef(false);
  const id = initial.id;

  async function run(send: () => Promise<boolean>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    let keepBusy = false;
    try { keepBusy = await send(); }
    finally {
      inFlight.current = keepBusy;
      setBusy(keepBusy);
    }
  }

  async function save(draft: Record<string, unknown>) {
    await run(async () => {
      const result = await sendEditorialCommand(kind, {
        operation: "save",
        draft: id ? { ...draft, id, expectedUpdatedAt: updatedAt } : draft,
      }, savedRecordSchema);
      if (!result.ok) {
        setFeedback({ tone: "error", text: result.message });
        setFields(result.fields);
        return false;
      }
      setFields({});
      if (!id) {
        // Stay busy while the browser moves to the new record's edit page.
        router.replace(`${editorialEditPath(kind, result.record.id)}?created=1`);
        return true;
      }
      setUpdatedAt(result.record.updatedAt);
      setDirty(false);
      setFeedback({ tone: "success", text: "Промените са запазени." });
      router.refresh();
      return false;
    });
  }

  async function setPublication(publish: boolean) {
    if (!id) return;
    await run(async () => {
      const result = await sendEditorialCommand(kind, { operation: publish ? "publish" : "unpublish", id }, savedRecordSchema);
      if (!result.ok) {
        setFeedback({ tone: "error", text: result.message });
        setFields(result.fields);
        return false;
      }
      setFields({});
      setStatus(result.record.status);
      setUpdatedAt(result.record.updatedAt);
      setFeedback(publish
        ? { tone: "success", text: "Материалът е публикуван и вече се вижда на сайта." }
        : { tone: "success", text: "Материалът е свален от публикация. Сега е чернова и можеш да го редактираш." });
      router.refresh();
      return false;
    });
  }

  function markDirty() {
    setDirty(true);
    setFeedback((current) => current?.tone === "success" ? null : current);
  }

  return { kind, id, status, busy, dirty, feedback, fields, markDirty, save, setPublication };
}
