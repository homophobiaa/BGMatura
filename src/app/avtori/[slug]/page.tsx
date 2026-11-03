import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { StudyText } from "@/components/learning-content";
import { listPublishedAuthorWorks } from "@/features/literature/server/catalog";
import { readPublicAuthor } from "@/features/learning/server/page-reading";
import { learningPageMetadata, missingLearningMetadata, studyDescription } from "@/features/learning/server/page-metadata";
import { Breadcrumbs } from "@/components/breadcrumbs";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const author = await readPublicAuthor(slug);
  return author ? learningPageMetadata(author.name, studyDescription(author.context, `Произведения и контекст за ${author.name}.`), `/avtori/${encodeURIComponent(author.slug)}`) : missingLearningMetadata();
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const author = await readPublicAuthor(slug);
  if (!author) notFound();
  const works = await listPublishedAuthorWorks(slug);
  return <article className="max-w-reading space-y-8">
    <Breadcrumbs items={[{ label: "Литература", href: "/literatura" }, { label: author.name }]} />
    <Link href="/literatura" className="inline-flex min-h-11 items-center text-primary underline">Към литературата</Link>
    <h1>{author.name}</h1>
    {author.context?.trim() && <StudyText text={author.context} />}
    <section className="space-y-4"><h2>Произведения</h2>
      {works.length ? <ul className="space-y-2">{works.map((work) => <li key={work.slug}>
        <Link className="inline-flex min-h-11 items-center text-primary underline" href={`/literatura/${encodeURIComponent(work.slug)}`}>{work.title}</Link>
        {work.genre && <span className="ml-3 text-caption text-muted">{work.genre}</span>}
      </li>)}</ul> : <p>Все още няма публикувани произведения от този автор.</p>}
    </section>
  </article>;
}
