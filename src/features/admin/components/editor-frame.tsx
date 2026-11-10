"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { editorialPreviewPath, publicationStatusLabels } from "../learning-kind-labels";
import type { EditorialEditorState } from "./use-editorial-editor";

/**
 * Shared shell for every learning editor: status, feedback, the form fields,
 * save, and the explicit preview/publish/unpublish controls.
 */
export function EditorFrame({ editor, label, onSubmit, children }: { editor: EditorialEditorState; label: string; onSubmit: () => void; children: ReactNode }) {
  const published = editor.status === "PUBLISHED";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return <div className="space-y-6">
    <p className="text-label">
      Състояние: <span className={published ? "text-success" : "text-pending"}>{publicationStatusLabels[editor.status]}</span>
      {editor.dirty && <span className="ml-3 text-warning">Има незапазени промени</span>}
    </p>
    {editor.feedback && <Feedback tone={editor.feedback.tone}>{editor.feedback.text}</Feedback>}
    {published && <Feedback tone="warning">Публикуваният материал не се редактира директно. Свали го от публикация, промени го и го публикувай отново.</Feedback>}
    <form aria-label={label} noValidate onSubmit={submit} onChange={editor.markDirty} className="space-y-6">
      <fieldset disabled={published || editor.busy} className="space-y-6">{children}</fieldset>
      {!published && <Button type="submit" busy={editor.busy}>{editor.id ? "Запази промените" : "Създай чернова"}</Button>}
    </form>
    {editor.id && <PublicationControls editor={editor} />}
  </div>;
}

function PublicationControls({ editor }: { editor: EditorialEditorState }) {
  const [confirmingUnpublish, setConfirmingUnpublish] = useState(false);
  if (!editor.id) return null;
  const previewHref = editorialPreviewPath(editor.kind, editor.id);

  return <section aria-labelledby="publication-heading" className="space-y-4 rounded-lg bg-surface-soft p-4 md:p-6">
    <h2 id="publication-heading" className="text-title">Публикуване</h2>
    <p className="text-caption text-muted">Прегледът показва последно запазената версия.</p>
    <div className="flex flex-wrap gap-3">
      <Button asChild variant="secondary"><Link href={previewHref} target="_blank" rel="noopener">Преглед</Link></Button>
      {editor.status === "DRAFT" && <Button type="button" busy={editor.busy} disabled={editor.dirty} aria-describedby={editor.dirty ? "publish-hint" : undefined}
        onClick={() => { void editor.setPublication(true); }}>Публикувай</Button>}
      {editor.status === "PUBLISHED" && !confirmingUnpublish &&
        <Button type="button" variant="secondary" disabled={editor.busy} onClick={() => setConfirmingUnpublish(true)}>Свали от публикация</Button>}
    </div>
    {editor.status === "DRAFT" && editor.dirty && <p id="publish-hint" className="text-caption text-warning">Запази промените, преди да публикуваш.</p>}
    {editor.status === "PUBLISHED" && confirmingUnpublish && <div role="group" aria-labelledby="unpublish-question" className="space-y-3">
      <p id="unpublish-question">Материалът ще изчезне от публичните страници, докато не го публикуваш отново. Да го сваля ли?</p>
      <div className="flex flex-wrap gap-3">
        <Button type="button" busy={editor.busy} onClick={() => { void editor.setPublication(false).then(() => setConfirmingUnpublish(false)); }}>Да, свали от публикация</Button>
        <Button type="button" variant="secondary" disabled={editor.busy} onClick={() => setConfirmingUnpublish(false)}>Откажи</Button>
      </div>
    </div>}
  </section>;
}
