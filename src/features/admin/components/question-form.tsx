"use client";

import { useRef, useState } from "react";
import { fieldMessages } from "../editorial-messages";
import { allowedAssessmentModes, buildQuestionDraft, defaultAssessmentMode, questionFieldKeys, type QuestionEditorState, type SubjectValue } from "../question-draft";
import { assessmentModeLabels, questionTypeLabels, questionTypes } from "../question-list-filters";
import { EditorFrame } from "./editor-frame";
import { SelectField, TextAreaField, TextField } from "./form-fields";
import { AcceptedAnswersEditor, MultipleChoiceEditor, WrittenGuidanceEditor } from "./question-answer-editors";
import { useEditorialEditor } from "./use-editorial-editor";

export type QuestionFormRecord = { id: string; status: "DRAFT" | "PUBLISHED"; updatedAt: string; state: QuestionEditorState };
type Choice = { id: string; title: string; status: "DRAFT" | "PUBLISHED" };
type TopicChoice = Choice & { subject: SubjectValue };

export const emptyQuestionState: QuestionEditorState = {
  subject: "BULGARIAN_LANGUAGE", type: "MULTIPLE_CHOICE", assessmentMode: "OBJECTIVE", prompt: "", maximumPoints: "1",
  explanation: "", acceptedAnswersText: "", options: [], correctOptionKey: null, referenceGuidance: "", rubric: [],
  topicIds: [], workIds: [],
  provenance: { origin: "ORIGINAL", editorName: "", attribution: "", sourceReference: "", reviewNotes: "", reviewed: false },
};

const originLabels = { ORIGINAL: "Авторски въпрос", ADAPTED: "Адаптиран от източник", OFFICIAL: "Официален материал" } as const;

function toggle(values: readonly string[], value: string, on: boolean) {
  return on ? [...values, value] : values.filter((existing) => existing !== value);
}

/**
 * The question editor. Shared fields live here; answer-specific controls are delegated
 * to one editor per question type, so each variant sends only its own fields.
 */
export function QuestionForm({ record, topics, works }: { record?: QuestionFormRecord | undefined; topics: TopicChoice[]; works: Choice[] }) {
  const editor = useEditorialEditor("question", record ?? {});
  const [state, setState] = useState<QuestionEditorState>(record?.state ?? emptyQuestionState);
  const nextKey = useRef(0);
  const createKey = () => `new-${nextKey.current++}`;
  const errors = (field: string) => [...new Set((questionFieldKeys[field] ?? [field]).flatMap((key) => fieldMessages(editor.fields, key)))];
  const update = (changes: Partial<QuestionEditorState>) => { setState((current) => ({ ...current, ...changes })); editor.markDirty(); };
  const mode = defaultAssessmentMode(state.type, state.assessmentMode);
  const objective = mode === "OBJECTIVE";
  const subjectTopics = topics.filter((topic) => topic.subject === state.subject);

  return <EditorFrame editor={editor} label="Данни за въпроса" onSubmit={() => { void editor.save(buildQuestionDraft(state)); }}>
    <div className="grid gap-4 md:grid-cols-2">
      <SelectField id="question-subject" label="Предмет" value={state.subject}
        onChange={(event) => update({ subject: event.target.value === "LITERATURE" ? "LITERATURE" : "BULGARIAN_LANGUAGE", topicIds: [], workIds: [] })}>
        <option value="BULGARIAN_LANGUAGE">Български език</option>
        <option value="LITERATURE">Литература</option>
      </SelectField>
      <SelectField id="question-type" label="Вид въпрос" value={state.type} onChange={(event) => {
        const type = questionTypes.find((value) => value === event.target.value) ?? "MULTIPLE_CHOICE";
        update({ type, assessmentMode: defaultAssessmentMode(type, state.assessmentMode) });
      }}>
        {questionTypes.map((type) => <option key={type} value={type}>{questionTypeLabels[type]}</option>)}
      </SelectField>
    </div>
    <SelectField id="question-mode" label="Оценяване" value={mode} disabled={allowedAssessmentModes[state.type].length === 1}
      hint={objective ? "Системата проверява отговора и дава точки." : "Системата не дава точки. Ученикът сравнява отговора си с насоките."}
      onChange={(event) => update({ assessmentMode: allowedAssessmentModes[state.type].find((value) => value === event.target.value) ?? mode })}>
      {allowedAssessmentModes[state.type].map((value) => <option key={value} value={value}>{assessmentModeLabels[value]}</option>)}
    </SelectField>
    <TextAreaField id="question-prompt" label="Условие" rows={4} maxLength={20000} required value={state.prompt} errors={errors("prompt")}
      onChange={(event) => update({ prompt: event.target.value })} />

    {objective && <TextField id="question-points" label="Точки" inputMode="decimal" value={state.maximumPoints} errors={errors("maximumPoints")}
      hint="До два знака след десетичната запетая, например 1,5." onChange={(event) => update({ maximumPoints: event.target.value })} />}

    {state.type === "MULTIPLE_CHOICE" && <MultipleChoiceEditor options={state.options} correctOptionKey={state.correctOptionKey} errors={errors("options")}
      createKey={createKey} onChange={(options, correctOptionKey) => update({ options, correctOptionKey })} />}
    {state.type === "SHORT_RESPONSE" && objective && <AcceptedAnswersEditor value={state.acceptedAnswersText} errors={errors("acceptedAnswers")}
      onChange={(acceptedAnswersText) => update({ acceptedAnswersText })} />}
    {objective && <TextAreaField id="question-explanation" label="Обяснение" rows={4} maxLength={20000} value={state.explanation} errors={errors("explanation")}
      hint="Ученикът вижда обяснението след като отговори. Нужно е за публикуване." onChange={(event) => update({ explanation: event.target.value })} />}
    {!objective && <WrittenGuidanceEditor guidance={state.referenceGuidance} rubric={state.rubric} guidanceErrors={errors("referenceGuidance")} rubricErrors={errors("rubric")}
      createKey={createKey} onGuidanceChange={(referenceGuidance) => update({ referenceGuidance })} onRubricChange={(rubric) => update({ rubric })} />}

    <fieldset className="space-y-3">
      <legend className="text-label">Теми</legend>
      <p className="text-caption text-muted">Поне една тема е нужна за публикуване. Въпросът се появява в упражненията по избраните теми.</p>
      {subjectTopics.length === 0 && <p className="text-caption">Няма теми за този предмет.</p>}
      <div className="grid gap-1 md:grid-cols-2">{subjectTopics.map((topic) => <label key={topic.id} className="flex min-h-11 items-center gap-3">
        <input type="checkbox" className="size-5 accent-primary" checked={state.topicIds.includes(topic.id)} onChange={(event) => update({ topicIds: toggle(state.topicIds, topic.id, event.target.checked) })} />
        {topic.title}{topic.status === "DRAFT" ? " (чернова)" : ""}
      </label>)}</div>
      {errors("topicIds").map((message) => <p key={message} className="text-caption text-error">{message}</p>)}
    </fieldset>

    {state.subject === "LITERATURE" && <fieldset className="space-y-3">
      <legend className="text-label">Произведения (по желание)</legend>
      <div className="grid gap-1 md:grid-cols-2">{works.map((work) => <label key={work.id} className="flex min-h-11 items-center gap-3">
        <input type="checkbox" className="size-5 accent-primary" checked={state.workIds.includes(work.id)} onChange={(event) => update({ workIds: toggle(state.workIds, work.id, event.target.checked) })} />
        {work.title}{work.status === "DRAFT" ? " (чернова)" : ""}
      </label>)}</div>
      {errors("workIds").map((message) => <p key={message} className="text-caption text-error">{message}</p>)}
    </fieldset>}

    <fieldset className="space-y-4 rounded-lg bg-surface-soft p-4">
      <legend className="text-label">Произход и преглед</legend>
      <SelectField id="question-origin" label="Произход" value={state.provenance.origin}
        onChange={(event) => update({ provenance: { ...state.provenance, origin: event.target.value === "ADAPTED" ? "ADAPTED" : event.target.value === "OFFICIAL" ? "OFFICIAL" : "ORIGINAL" } })}>
        {Object.entries(originLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </SelectField>
      <TextField id="question-editor-name" label="Редактор" value={state.provenance.editorName} hint="Кой е написал или адаптирал въпроса. Не се показва на учениците."
        onChange={(event) => update({ provenance: { ...state.provenance, editorName: event.target.value } })} />
      <TextField id="question-attribution" label="Посочване на източника" value={state.provenance.attribution} hint="Показва се на учениците. Задължително за адаптирани и официални материали."
        onChange={(event) => update({ provenance: { ...state.provenance, attribution: event.target.value } })} />
      <TextField id="question-source" label="Точен източник" value={state.provenance.sourceReference} hint="Документ, страница или адрес. Не се показва на учениците."
        onChange={(event) => update({ provenance: { ...state.provenance, sourceReference: event.target.value } })} />
      <TextAreaField id="question-review-notes" label="Бележки от прегледа" rows={3} value={state.provenance.reviewNotes}
        onChange={(event) => update({ provenance: { ...state.provenance, reviewNotes: event.target.value } })} />
      <label className="flex min-h-11 items-center gap-3 text-label">
        <input type="checkbox" className="size-5 accent-primary" checked={state.provenance.reviewed} onChange={(event) => update({ provenance: { ...state.provenance, reviewed: event.target.checked } })} />
        Прегледах въпроса и потвърждавам, че е верен
      </label>
      <p className="text-caption text-muted">Всяко запазване без тази отметка нулира прегледа. Прегледът е нужен за публикуване.</p>
      {errors("provenance").map((message) => <p key={message} className="text-caption text-error">{message}</p>)}
    </fieldset>
  </EditorFrame>;
}

