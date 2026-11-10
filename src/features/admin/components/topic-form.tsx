"use client";

import { useState } from "react";
import { fieldMessages } from "../editorial-messages";
import { EditorFrame } from "./editor-frame";
import { SelectField, TextField } from "./form-fields";
import { SlugField } from "./slug-field";
import { useEditorialEditor } from "./use-editorial-editor";

type Subject = "BULGARIAN_LANGUAGE" | "LITERATURE";
export type TopicFormRecord = { id: string; title: string; slug: string; subject: Subject; parentId: string | null; position: number; status: "DRAFT" | "PUBLISHED"; updatedAt: string };
export type TopicChoice = { id: string; title: string; parentId: string | null; subject: Subject; status: "DRAFT" | "PUBLISHED" };

/** Topics the record may not choose as parent: itself and everything below it. */
function descendantsOf(topicId: string, topics: readonly TopicChoice[]): Set<string> {
  const blocked = new Set([topicId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const topic of topics) {
      if (topic.parentId && blocked.has(topic.parentId) && !blocked.has(topic.id)) { blocked.add(topic.id); grew = true; }
    }
  }
  return blocked;
}

export function TopicForm({ record, topics }: { record?: TopicFormRecord | undefined; topics: TopicChoice[] }) {
  const editor = useEditorialEditor("topic", record ?? {});
  const [title, setTitle] = useState(record?.title ?? "");
  const [slug, setSlug] = useState(record?.slug ?? "");
  const [subject, setSubject] = useState<Subject>(record?.subject ?? "BULGARIAN_LANGUAGE");
  const [parentId, setParentId] = useState(record?.parentId ?? "");
  const [position, setPosition] = useState(String(record?.position ?? 0));
  const errors = (field: string) => fieldMessages(editor.fields, field);
  const blocked = record ? descendantsOf(record.id, topics) : new Set<string>();
  const parentChoices = topics.filter((topic) => topic.subject === subject && !blocked.has(topic.id));

  return <EditorFrame editor={editor} label="Данни за темата" onSubmit={() => {
    void editor.save({ title, slug, subject, parentId: parentId || null, position: Number(position) });
  }}>
    <TextField id="topic-title" label="Заглавие" value={title} maxLength={200} required errors={errors("title")} onChange={(event) => setTitle(event.target.value)} />
    <SlugField id="topic-slug" value={slug} title={title} publicPathPrefix={null} errors={errors("slug")} onChange={(value) => { setSlug(value); editor.markDirty(); }} />
    <SelectField id="topic-subject" label="Предмет" value={subject} errors={errors("subject")}
      onChange={(event) => { setSubject(event.target.value === "LITERATURE" ? "LITERATURE" : "BULGARIAN_LANGUAGE"); setParentId(""); }}>
      <option value="BULGARIAN_LANGUAGE">Български език</option>
      <option value="LITERATURE">Литература</option>
    </SelectField>
    <SelectField id="topic-parent" label="Родителска тема" value={parentId} errors={errors("parentId")}
      hint="Остави празно за основна тема. Подтемата се публикува само след родителските теми." onChange={(event) => setParentId(event.target.value)}>
      <option value="">Няма (основна тема)</option>
      {parentChoices.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}{topic.status === "DRAFT" ? " (чернова)" : ""}</option>)}
    </SelectField>
    <TextField id="topic-position" label="Позиция" type="number" inputMode="numeric" min={0} max={10000} step={1} value={position}
      hint="По-малко число се показва по-напред." errors={errors("position")} onChange={(event) => setPosition(event.target.value)} />
  </EditorFrame>;
}
