"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { inputClassName } from "@/components/ui/input";
import type { LearningContent } from "@/features/learning/content";
import { fieldMessages, translateEditorialMessage } from "../editorial-messages";
import { blocksFromContent, blockTypeLabels, contentFromBlocks, emptyBlock, type EditableBlock, type EditableBlockType } from "../lesson-blocks";
import { EditorFrame } from "./editor-frame";
import { SelectField, TextAreaField, TextField } from "./form-fields";
import { SlugField } from "./slug-field";
import { useEditorialEditor } from "./use-editorial-editor";

export type LessonFormRecord = { id: string; title: string; slug: string; topicId: string; content: LearningContent; status: "DRAFT" | "PUBLISHED"; updatedAt: string };

const linkHint = "Връзка се пише така: [текст](/адрес) или [текст](https://…).";
const blockTypes = Object.keys(blockTypeLabels) as EditableBlockType[];

export function LessonForm({ record, topics }: { record?: LessonFormRecord | undefined; topics: { id: string; title: string; status: "DRAFT" | "PUBLISHED" }[] }) {
  const editor = useEditorialEditor("lesson", record ?? {});
  // Saved blocks get "saved-" keys while rendering; blocks added later get "new-" keys in event handlers.
  const nextNewKey = useRef(0);
  const [title, setTitle] = useState(record?.title ?? "");
  const [slug, setSlug] = useState(record?.slug ?? "");
  const [topicId, setTopicId] = useState(record?.topicId ?? "");
  const [blocks, setBlocks] = useState<EditableBlock[]>(() => {
    let nextSavedKey = 0;
    return record ? blocksFromContent(record.content, () => `saved-${nextSavedKey++}`) : [];
  });
  const errors = (field: string) => fieldMessages(editor.fields, field);

  function updateBlock(index: number, block: EditableBlock) {
    setBlocks((current) => current.map((existing, position) => position === index ? block : existing));
    editor.markDirty();
  }
  function moveBlock(index: number, offset: -1 | 1) {
    setBlocks((current) => {
      const target = index + offset;
      const moved = current[index];
      const other = current[target];
      if (!moved || !other) return current;
      const next = [...current];
      next[index] = other;
      next[target] = moved;
      return next;
    });
    editor.markDirty();
  }
  function removeBlock(index: number) {
    setBlocks((current) => current.filter((_, position) => position !== index));
    editor.markDirty();
  }
  function addBlock(type: EditableBlockType) {
    setBlocks((current) => [...current, emptyBlock(type, `new-${nextNewKey.current++}`)]);
    editor.markDirty();
  }

  return <EditorFrame editor={editor} label="Данни за урока" onSubmit={() => {
    void editor.save({ title, slug, topicId, content: contentFromBlocks(blocks) });
  }}>
    <TextField id="lesson-title" label="Заглавие" value={title} maxLength={200} required errors={errors("title")} onChange={(event) => setTitle(event.target.value)} />
    <SlugField id="lesson-slug" value={slug} title={title} publicPathPrefix="/balgarski-ezik/" errors={errors("slug")} onChange={(value) => { setSlug(value); editor.markDirty(); }} />
    <SelectField id="lesson-topic" label="Тема по български език" value={topicId} required errors={errors("topicId")}
      hint={topics.length ? "За публикуване темата и родителските ѝ теми трябва да са публикувани." : "Първо създай тема по български език."}
      onChange={(event) => setTopicId(event.target.value)}>
      <option value="">Избери тема</option>
      {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}{topic.status === "DRAFT" ? " (чернова)" : ""}</option>)}
    </SelectField>

    <section aria-labelledby="lesson-content-heading" className="space-y-4">
      <h2 id="lesson-content-heading" className="text-title">Съдържание</h2>
      <p className="text-caption text-muted">За публикуване са нужни поне един абзац с обяснение и един пример. {linkHint}</p>
      {(editor.fields.content ?? []).map(translateEditorialMessage).map((message) =>
        <p key={message} className="text-caption text-error">{message}</p>)}
      {blocks.length === 0 && <p className="rounded-lg bg-surface-soft p-4">Урокът още няма съдържание. Добави първия блок отдолу.</p>}
      <ol className="space-y-4">
        {blocks.map((block, index) => <li key={block.key} className="space-y-4 rounded-lg border border-hairline p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-label">{index + 1}. {blockTypeLabels[block.type]}</h3>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" aria-label={`Премести блок ${index + 1} нагоре`} disabled={index === 0} onClick={() => moveBlock(index, -1)}><ArrowUp aria-hidden="true" /></Button>
              <Button type="button" variant="secondary" aria-label={`Премести блок ${index + 1} надолу`} disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)}><ArrowDown aria-hidden="true" /></Button>
              <Button type="button" variant="secondary" aria-label={`Премахни блок ${index + 1}`} onClick={() => removeBlock(index)}><Trash2 aria-hidden="true" /></Button>
            </div>
          </div>
          <BlockFields block={block} prefix={`lesson-block-${block.key}`} errors={fieldMessages(editor.fields, `content.blocks.${index}`)} onChange={(next) => updateBlock(index, next)} />
        </li>)}
      </ol>
      <div role="group" aria-label="Добави блок" className="flex flex-wrap gap-2">
        {blockTypes.map((type) => <Button key={type} type="button" variant="secondary" onClick={() => addBlock(type)}>+ {blockTypeLabels[type]}</Button>)}
      </div>
    </section>
  </EditorFrame>;
}

function BlockFields({ block, prefix, errors, onChange }: { block: EditableBlock; prefix: string; errors: string[]; onChange: (block: EditableBlock) => void }) {
  switch (block.type) {
    case "paragraph":
      return <TextAreaField id={`${prefix}-text`} label="Текст на абзаца" rows={5} errors={errors} value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} />;
    case "heading":
      return <div className="grid gap-4 md:grid-cols-[10rem_1fr]">
        <div className="space-y-2"><label htmlFor={`${prefix}-level`} className="block text-label">Ниво</label>
          <select id={`${prefix}-level`} className={inputClassName} value={block.level} onChange={(event) => onChange({ ...block, level: event.target.value === "3" ? 3 : 2 })}>
            <option value="2">Раздел</option><option value="3">Подраздел</option>
          </select></div>
        <TextField id={`${prefix}-text`} label="Текст на заглавието" errors={errors} value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} />
      </div>;
    case "list":
      return <div className="space-y-4">
        <label className="flex min-h-11 items-center gap-3 text-label"><input type="checkbox" className="size-5" checked={block.ordered} onChange={(event) => onChange({ ...block, ordered: event.target.checked })} />Номериран списък</label>
        <TextAreaField id={`${prefix}-items`} label="Елементи" hint="Всеки ред е отделен елемент." rows={5} errors={errors} value={block.itemsText} onChange={(event) => onChange({ ...block, itemsText: event.target.value })} />
      </div>;
    case "example":
      return <div className="space-y-4">
        <TextField id={`${prefix}-title`} label="Заглавие на примера" value={block.title} onChange={(event) => onChange({ ...block, title: event.target.value })} />
        <TextAreaField id={`${prefix}-text`} label="Текст на примера" rows={4} errors={errors} value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} />
      </div>;
    case "quotation":
      return <div className="space-y-4">
        <TextAreaField id={`${prefix}-text`} label="Цитат" rows={4} value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} />
        <TextField id={`${prefix}-attribution`} label="Източник" errors={errors} value={block.attribution} onChange={(event) => onChange({ ...block, attribution: event.target.value })} />
      </div>;
  }
}
