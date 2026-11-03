import type { Metadata } from "next";
import { AdminAuthControl } from "@/features/admin/components/auth-controls";
import { hasAdminConfiguration } from "@/features/admin/server/environment";
import { Feedback } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Вход за редактори — BG Matura", robots: { index: false, follow: false } };

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parameters = await searchParams;
  return <section className="max-w-reading space-y-6"><h1>Вход за редактори</h1>
    <p>Достъпът е само за одобрени редактори. Учебните материали не изискват регистрация.</p>
    {parameters.error && <Feedback tone="error">Нямаш достъп до администрацията или входът е прекъснат.</Feedback>}
    {hasAdminConfiguration() ? <AdminAuthControl mode="login" /> : <Feedback>Входът за редактори временно не е настроен.</Feedback>}
  </section>;
}
