import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { StudentAuthControl } from "@/features/account/components/student-auth-control";
import { safeReturnPath } from "@/features/account/return-path";
import { getSignedInUser } from "@/features/admin/server/authorization";
import { hasAdminConfiguration } from "@/features/admin/server/environment";

export const metadata: Metadata = {
  title: "Вход и регистрация — BG Matura",
  description: "Влез с Google, за да запазваш резултатите си. За учене и упражнения не ти трябва профил.",
  robots: { index: false, follow: true },
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parameters = await searchParams;
  const returnTo = safeReturnPath(parameters.next);
  const configured = hasAdminConfiguration();
  const user = configured ? await getSignedInUser(new Headers(await headers())).catch(() => null) : null;

  return (
    <article className="max-w-reading space-y-8">
      <header className="space-y-4">
        <h1>Вход и регистрация</h1>
        <p className="text-body-lg">
          Влез с Google акаунта си. Ако си тук за първи път, профилът ти се създава автоматично — това е цялата регистрация.
        </p>
      </header>

      {parameters.error ? <Feedback tone="error">Входът не беше завършен. Опитай отново.</Feedback> : null}

      {user ? (
        <section aria-labelledby="signed-in" className="space-y-4">
          <h2 id="signed-in" className="text-title">Вече си влязъл</h2>
          <p>Влязъл си като {user.name}.</p>
          <div className="flex flex-wrap items-start gap-3">
            <Button asChild><Link href={returnTo}>Продължи</Link></Button>
            <StudentAuthControl mode="logout" returnTo="/" />
          </div>
        </section>
      ) : configured ? (
        <StudentAuthControl mode="login" returnTo={returnTo} />
      ) : (
        <Feedback>Входът още не е настроен. Опитай по-късно. Можеш да учиш и да се упражняваш и без профил.</Feedback>
      )}

      <section aria-labelledby="benefits" className="space-y-3 rounded-lg bg-surface-card p-4 md:p-6">
        <h2 id="benefits" className="text-title">Какво получаваш с профил</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>Запазваш резултатите си и ги виждаш от всяко устройство.</li>
          <li>Не се пази парола: входът е през твоя Google акаунт.</li>
        </ul>
      </section>

      <section aria-labelledby="without-account" className="space-y-3">
        <h2 id="without-account" className="text-title">Не ти трябва профил, за да учиш</h2>
        <p>Уроците, упражненията и пробните матури работят и без вход. Профилът е само удобство.</p>
      </section>

      <section aria-labelledby="data" className="space-y-3">
        <h2 id="data" className="text-title">Какво пазим</h2>
        <p>Само името и потвърдения имейл от Google. Не пазим парола и снимка. Прочети <Link href="/poveritelnost" className="text-primary underline underline-offset-4">известието за поверителност</Link>; профилът се изтрива по всяко време.</p>
        <p>Профил могат да правят ученици на 14 или повече години. Под 14 години използвай сайта без профил.</p>
      </section>
    </article>
  );
}
