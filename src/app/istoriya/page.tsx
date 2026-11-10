import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { HistoryList } from "@/features/account/components/history-list";
import { getSignedInUser } from "@/features/admin/server/authorization";
import { hasAdminConfiguration } from "@/features/admin/server/environment";
import { listStudentHistory } from "@/features/attempts/server/history";

export const metadata: Metadata = { title: "Моята история — BG Matura", robots: { index: false, follow: false } };

export default async function HistoryPage() {
  const user = hasAdminConfiguration() ? await getSignedInUser(new Headers(await headers())).catch(() => null) : null;
  if (user === null) redirect("/vhod?next=/istoriya");
  const page = await listStudentHistory(user.id).catch(() => null);

  return (
    <article className="max-w-reading space-y-8">
      <header className="space-y-4">
        <h1>Моята история</h1>
        <p className="text-body-lg">Резултатите, които си запазил, най-новите първи.</p>
      </header>
      {page === null
        ? <p role="alert">Не успяхме да заредим историята ти. Опитай отново след малко.</p>
        : <HistoryList initialItems={page.items} initialCursor={page.nextCursor} />}
    </article>
  );
}
