"use client";

import { useState } from "react";
import { fieldMessages } from "../editorial-messages";
import { EditorFrame } from "./editor-frame";
import { TextAreaField, TextField } from "./form-fields";
import { SlugField } from "./slug-field";
import { useEditorialEditor } from "./use-editorial-editor";

export type AuthorFormRecord = { id: string; name: string; slug: string; context: string | null; status: "DRAFT" | "PUBLISHED"; updatedAt: string };

export function AuthorForm({ record }: { record?: AuthorFormRecord | undefined }) {
  const editor = useEditorialEditor("author", record ?? {});
  const [name, setName] = useState(record?.name ?? "");
  const [slug, setSlug] = useState(record?.slug ?? "");
  const [context, setContext] = useState(record?.context ?? "");
  const errors = (field: string) => fieldMessages(editor.fields, field);

  return <EditorFrame editor={editor} label="Данни за автора" onSubmit={() => {
    void editor.save({ name, slug, context: context.trim() ? context : null });
  }}>
    <TextField id="author-name" label="Име" value={name} maxLength={200} required errors={errors("name")} onChange={(event) => setName(event.target.value)} />
    <SlugField id="author-slug" value={slug} title={name} publicPathPrefix="/avtori/" errors={errors("slug")} onChange={(value) => { setSlug(value); editor.markDirty(); }} />
    <TextAreaField id="author-context" label="Контекст" rows={10} maxLength={20000} errors={errors("context")}
      hint="Кратък контекст за епохата и творчеството. Нужен е за публикуване. Празен ред започва нов абзац."
      value={context} onChange={(event) => setContext(event.target.value)} />
  </EditorFrame>;
}
