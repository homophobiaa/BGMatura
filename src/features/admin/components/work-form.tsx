"use client";

import { useState } from "react";
import { fieldMessages } from "../editorial-messages";
import { listItemsFromText } from "../lesson-blocks";
import { EditorFrame } from "./editor-frame";
import { SelectField, TextAreaField, TextField } from "./form-fields";
import { SlugField } from "./slug-field";
import { useEditorialEditor } from "./use-editorial-editor";

export type WorkFormRecord = {
  id: string; title: string; slug: string; authorId: string; genre: string | null; summary: string | null;
  themes: string[]; characters: string[]; importantIdeas: string[]; interpretation: string | null;
  status: "DRAFT" | "PUBLISHED"; updatedAt: string;
};

const nullable = (value: string) => value.trim() ? value : null;

export function WorkForm({ record, authors }: { record?: WorkFormRecord | undefined; authors: { id: string; name: string; status: "DRAFT" | "PUBLISHED" }[] }) {
  const editor = useEditorialEditor("work", record ?? {});
  const [title, setTitle] = useState(record?.title ?? "");
  const [slug, setSlug] = useState(record?.slug ?? "");
  const [authorId, setAuthorId] = useState(record?.authorId ?? "");
  const [genre, setGenre] = useState(record?.genre ?? "");
  const [summary, setSummary] = useState(record?.summary ?? "");
  const [themes, setThemes] = useState(record?.themes.join("\n") ?? "");
  const [characters, setCharacters] = useState(record?.characters.join("\n") ?? "");
  const [importantIdeas, setImportantIdeas] = useState(record?.importantIdeas.join("\n") ?? "");
  const [interpretation, setInterpretation] = useState(record?.interpretation ?? "");
  const errors = (field: string) => fieldMessages(editor.fields, field);
  const listHint = "Всеки ред е отделен елемент.";

  return <EditorFrame editor={editor} label="Данни за произведението" onSubmit={() => {
    void editor.save({
      title, slug, authorId, genre: nullable(genre), summary: nullable(summary), interpretation: nullable(interpretation),
      themes: listItemsFromText(themes), characters: listItemsFromText(characters), importantIdeas: listItemsFromText(importantIdeas),
    });
  }}>
    <TextField id="work-title" label="Заглавие" value={title} maxLength={200} required errors={errors("title")} onChange={(event) => setTitle(event.target.value)} />
    <SlugField id="work-slug" value={slug} title={title} publicPathPrefix="/literatura/" errors={errors("slug")} onChange={(value) => { setSlug(value); editor.markDirty(); }} />
    <SelectField id="work-author" label="Автор" value={authorId} required errors={errors("authorId")}
      hint={authors.length ? "За публикуване авторът трябва да е публикуван." : "Първо създай автор."}
      onChange={(event) => setAuthorId(event.target.value)}>
      <option value="">Избери автор</option>
      {authors.map((author) => <option key={author.id} value={author.id}>{author.name}{author.status === "DRAFT" ? " (чернова)" : ""}</option>)}
    </SelectField>
    <TextField id="work-genre" label="Жанр" value={genre} maxLength={200} errors={errors("genre")} onChange={(event) => setGenre(event.target.value)} />
    <TextAreaField id="work-summary" label="Резюме" rows={8} maxLength={20000} errors={errors("summary")} value={summary} onChange={(event) => setSummary(event.target.value)} />
    <TextAreaField id="work-themes" label="Теми" rows={4} hint={listHint} errors={errors("themes")} value={themes} onChange={(event) => setThemes(event.target.value)} />
    <TextAreaField id="work-characters" label="Герои" rows={4} hint={`${listHint} Може да остане празно, например за лирика.`} errors={errors("characters")} value={characters} onChange={(event) => setCharacters(event.target.value)} />
    <TextAreaField id="work-ideas" label="Важни идеи" rows={4} hint={listHint} errors={errors("importantIdeas")} value={importantIdeas} onChange={(event) => setImportantIdeas(event.target.value)} />
    <TextAreaField id="work-interpretation" label="Насоки за прочит" rows={8} maxLength={20000} errors={errors("interpretation")} value={interpretation} onChange={(event) => setInterpretation(event.target.value)} />
  </EditorFrame>;
}
