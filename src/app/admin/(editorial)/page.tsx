import type { Metadata } from "next";
import Link from "next/link";
import { learningKinds } from "@/features/learning/kinds";
import { learningKindLabels, learningListPath } from "@/features/admin/learning-kind-labels";
import { requireAdminPage } from "@/features/admin/server/page-authorization";

export const metadata: Metadata = { title: "Администрация — BG Matura", robots: { index: false, follow: false } };

export default async function AdminPage() {
  await requireAdminPage();
  return <section className="space-y-6">
    <h1>Администрация</h1>
    <p className="max-w-reading">Избери вид съдържание. Новите записи се създават като чернови и се виждат на сайта едва след публикуване.</p>
    <ul aria-label="Съдържание" className="grid gap-4 md:grid-cols-2">
      {learningKinds.map((kind) => <li key={kind} className="rounded-lg bg-surface-card p-4 md:p-6">
        <h2 className="text-title"><Link href={learningListPath(kind)} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">{learningKindLabels[kind].plural}</Link></h2>
        <p>{learningKindLabels[kind].description}</p>
      </li>)}
      <li className="rounded-lg bg-surface-card p-4 md:p-6">
        <h2 className="text-title"><Link href="/admin/questions" className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Въпроси</Link></h2>
        <p>Банка с въпроси за упражнения и пробни матури.</p>
      </li>
    </ul>
  </section>;
}
