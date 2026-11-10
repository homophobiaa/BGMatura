import "server-only";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Feedback } from "@/components/ui/feedback";
import { AuthorForm, type AuthorFormRecord } from "@/features/admin/components/author-form";
import { LessonForm, type LessonFormRecord } from "@/features/admin/components/lesson-form";
import { TopicForm, type TopicFormRecord } from "@/features/admin/components/topic-form";
import { WorkForm, type WorkFormRecord } from "@/features/admin/components/work-form";
import { learningKindLabels, learningListPath } from "@/features/admin/learning-kind-labels";
import { listAuthorOptions, listTopicOptions } from "@/features/admin/server/learning-lists";
import type { LearningKind } from "@/features/learning/kinds";

export type EditorRecord =
  | { kind: "author"; record: AuthorFormRecord }
  | { kind: "work"; record: WorkFormRecord }
  | { kind: "topic"; record: TopicFormRecord }
  | { kind: "lesson"; record: LessonFormRecord };

/** Shared body of the "new" and "edit" pages: loads the choices a form needs and renders it. */
export async function LearningEditorPage({ kind, editing, created, requestHeaders }: {
  kind: LearningKind; editing: EditorRecord | undefined; created: boolean; requestHeaders: Headers;
}) {
  const labels = learningKindLabels[kind];
  const title = editing ? editingTitle(editing) : labels.create;
  return <section className="max-w-reading space-y-6">
    <Breadcrumbs items={[{ label: "Администрация", href: "/admin" }, { label: labels.plural, href: learningListPath(kind) }, { label: title }]} />
    <h1 className="[overflow-wrap:anywhere]">{title}</h1>
    {created && <Feedback tone="success">Черновата е създадена. Можеш да продължиш с редакцията.</Feedback>}
    {await editorForm(kind, editing, requestHeaders)}
  </section>;
}

function editingTitle(editing: EditorRecord) {
  return editing.kind === "author" ? editing.record.name : editing.record.title;
}

async function editorForm(kind: LearningKind, editing: EditorRecord | undefined, requestHeaders: Headers) {
  switch (kind) {
    case "author":
      return <AuthorForm record={editing?.kind === "author" ? editing.record : undefined} />;
    case "work":
      return <WorkForm record={editing?.kind === "work" ? editing.record : undefined} authors={await listAuthorOptions(requestHeaders)} />;
    case "topic":
      return <TopicForm record={editing?.kind === "topic" ? editing.record : undefined} topics={await listTopicOptions(requestHeaders)} />;
    case "lesson": {
      const topics = (await listTopicOptions(requestHeaders)).filter((topic) => topic.subject === "BULGARIAN_LANGUAGE");
      return <LessonForm record={editing?.kind === "lesson" ? editing.record : undefined} topics={topics} />;
    }
  }
}
