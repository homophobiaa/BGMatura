import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DeleteAccountControl } from "@/features/account/components/delete-account-control";
import { StudentAuthControl } from "@/features/account/components/student-auth-control";
import { getSignedInUser } from "@/features/admin/server/authorization";
import { hasAdminConfiguration } from "@/features/admin/server/environment";

export const metadata: Metadata = { title: "Моят профил — BG Matura", robots: { index: false, follow: false } };

export default async function ProfilePage() {
  const user = hasAdminConfiguration() ? await getSignedInUser(new Headers(await headers())).catch(() => null) : null;
  if (user === null) redirect("/vhod?next=/profil");

  return (
    <article className="max-w-reading space-y-8">
      <header className="space-y-4">
        <h1>Моят профил</h1>
        <p className="text-body-lg">Влязъл си като {user.name}.</p>
      </header>

      <section aria-labelledby="kept" className="space-y-3">
        <h2 id="kept" className="text-title">Какво пазим за теб</h2>
        <p>Само името и потвърдения имейл от Google, и резултатите, които си запазил. Повече в <Link href="/poveritelnost" className="text-primary underline underline-offset-4">известието за поверителност</Link>.</p>
      </section>

      <section aria-labelledby="leave" className="space-y-3">
        <h2 id="leave" className="text-title">Изход</h2>
        <StudentAuthControl mode="logout" returnTo="/" />
      </section>

      <section aria-labelledby="remove" className="space-y-3">
        <h2 id="remove" className="text-title">Изтриване</h2>
        <DeleteAccountControl />
      </section>
    </article>
  );
}
