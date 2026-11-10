"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EditableCriterion, EditableOption } from "../question-draft";
import { TextAreaField } from "./form-fields";

function ErrorList({ id, errors }: { id: string; errors: readonly string[] }) {
  if (!errors.length) return null;
  return <ul id={id} className="space-y-1 text-caption text-error">{errors.map((error) => <li key={error}>{error}</li>)}</ul>;
}

function move<T>(items: readonly T[], index: number, offset: -1 | 1): T[] {
  const target = index + offset;
  const moved = items[index];
  const other = items[target];
  if (moved === undefined || other === undefined) return [...items];
  const next = [...items];
  next[index] = other;
  next[target] = moved;
  return next;
}

/**
 * Answer options with an explicit correct choice. Each option keeps a stable client key,
 * so reordering or removing another option never moves the correct mark to a different text.
 */
export function MultipleChoiceEditor({ options, correctOptionKey, errors, createKey, onChange }: {
  options: EditableOption[]; correctOptionKey: string | null; errors: readonly string[]; createKey: () => string;
  onChange: (options: EditableOption[], correctOptionKey: string | null) => void;
}) {
  return <fieldset className="space-y-4" aria-describedby={errors.length ? "options-error" : undefined}>
    <legend className="text-label">Възможни отговори</legend>
    <p className="text-caption text-muted">Отбележи точно един верен отговор. За публикуване са нужни поне два различни отговора.</p>
    <ol className="space-y-3">
      {options.map((option, index) => <li key={option.key} className="space-y-2 rounded-lg border border-hairline p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex min-h-11 items-center gap-3 text-label">
            <input type="radio" name="correct-option" className="size-5 accent-primary" checked={option.key === correctOptionKey}
              onChange={() => onChange(options, option.key)} />
            Верен отговор
          </label>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" aria-label={`Премести отговор ${index + 1} нагоре`} disabled={index === 0} onClick={() => onChange(move(options, index, -1), correctOptionKey)}><ArrowUp aria-hidden="true" /></Button>
            <Button type="button" variant="secondary" aria-label={`Премести отговор ${index + 1} надолу`} disabled={index === options.length - 1} onClick={() => onChange(move(options, index, 1), correctOptionKey)}><ArrowDown aria-hidden="true" /></Button>
            <Button type="button" variant="secondary" aria-label={`Премахни отговор ${index + 1}`}
              onClick={() => onChange(options.filter((existing) => existing.key !== option.key), option.key === correctOptionKey ? null : correctOptionKey)}><Trash2 aria-hidden="true" /></Button>
          </div>
        </div>
        <label htmlFor={`option-${option.key}`} className="sr-only">Текст на отговор {index + 1}</label>
        <Input id={`option-${option.key}`} value={option.text} maxLength={20000} placeholder={`Отговор ${index + 1}`}
          onChange={(event) => onChange(options.map((existing) => existing.key === option.key ? { ...existing, text: event.target.value } : existing), correctOptionKey)} />
      </li>)}
    </ol>
    {options.length < 20 && <Button type="button" variant="secondary" onClick={() => onChange([...options, { key: createKey(), text: "" }], correctOptionKey)}>+ Добави отговор</Button>}
    <ErrorList id="options-error" errors={errors} />
  </fieldset>;
}

export function AcceptedAnswersEditor({ value, errors, onChange }: { value: string; errors: readonly string[]; onChange: (value: string) => void }) {
  return <TextAreaField id="question-accepted-answers" label="Приемливи отговори" rows={4} value={value} errors={errors}
    hint="Всеки ред е един приемлив отговор. Сравнението не отчита главни букви, интервали и кавички."
    onChange={(event) => onChange(event.target.value)} />;
}

/** Guidance and rubric for written answers. Rubric points are a guide for students, never a score. */
export function WrittenGuidanceEditor({ guidance, rubric, guidanceErrors, rubricErrors, createKey, onGuidanceChange, onRubricChange }: {
  guidance: string; rubric: EditableCriterion[]; guidanceErrors: readonly string[]; rubricErrors: readonly string[]; createKey: () => string;
  onGuidanceChange: (value: string) => void; onRubricChange: (rubric: EditableCriterion[]) => void;
}) {
  return <div className="space-y-6">
    <TextAreaField id="question-guidance" label="Насоки за самооценка" rows={6} maxLength={20000} value={guidance} errors={guidanceErrors}
      hint="Ученикът вижда насоките след като изпрати отговора. Нужни са за публикуване." onChange={(event) => onGuidanceChange(event.target.value)} />
    <fieldset className="space-y-4">
      <legend className="text-label">Критерии (по желание)</legend>
      <p className="text-caption text-muted">Точките са ориентир от официалните критерии. Системата не оценява текста.</p>
      <ol className="space-y-3">
        {rubric.map((criterion, index) => <li key={criterion.key} className="grid gap-3 rounded-lg border border-hairline p-3 md:grid-cols-[1fr_8rem_auto] md:items-end">
          <div className="space-y-2"><label htmlFor={`criterion-${criterion.key}`} className="block text-label">Критерий {index + 1}</label>
            <Input id={`criterion-${criterion.key}`} value={criterion.description}
              onChange={(event) => onRubricChange(rubric.map((existing) => existing.key === criterion.key ? { ...existing, description: event.target.value } : existing))} /></div>
          <div className="space-y-2"><label htmlFor={`criterion-points-${criterion.key}`} className="block text-label">Точки (ориентир)</label>
            <Input id={`criterion-points-${criterion.key}`} inputMode="decimal" value={criterion.indicativePoints}
              onChange={(event) => onRubricChange(rubric.map((existing) => existing.key === criterion.key ? { ...existing, indicativePoints: event.target.value } : existing))} /></div>
          <Button type="button" variant="secondary" aria-label={`Премахни критерий ${index + 1}`} onClick={() => onRubricChange(rubric.filter((existing) => existing.key !== criterion.key))}><Trash2 aria-hidden="true" /></Button>
        </li>)}
      </ol>
      <Button type="button" variant="secondary" onClick={() => {
        // Saved criteria keep their identifiers; a new one gets a random identifier so it cannot collide with them.
        onRubricChange([...rubric, { key: createKey(), id: `criterion-${crypto.randomUUID()}`, description: "", indicativePoints: "" }]);
      }}>+ Добави критерий</Button>
      <ErrorList id="rubric-error" errors={rubricErrors} />
    </fieldset>
  </div>;
}
