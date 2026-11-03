import { connection } from "next/server";

import { Feedback } from "@/components/ui/feedback";
import { TopicTree } from "@/features/language/components/topic-tree";
import { getLanguageCatalog } from "@/features/language/server/published-lessons";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { learningPageMetadata } from "@/features/learning/server/page-metadata";

export function generateMetadata() {
  return learningPageMetadata("Български език", "Правила, обяснения и примери по теми за подготовка за ДЗИ по БЕЛ.", "/balgarski-ezik");
}

export default async function LanguagePage() {
  await connection();
  const { topics, lessons } = await getLanguageCatalog();
  return <div className="max-w-reading space-y-8"><Breadcrumbs items={[{ label: "Учи", href: "/uchi" }, { label: "Български език" }]} /><h1>Български език</h1>
    <p className="text-body-lg">Избери тема и преговори правилата с обяснения и примери.</p>
    {topics.length ? <TopicTree topics={topics} lessons={lessons} /> : <Feedback>Все още няма публикувани теми. Подготвяме проверени уроци.</Feedback>}
  </div>;
}
