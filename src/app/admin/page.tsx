import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Feedback } from "@/components/ui/feedback";
import { AdminAuthControl } from "@/features/admin/components/auth-controls";
import { AdminAuthorizationError, getSignedInUser, requireAdmin } from "@/features/admin/server/authorization";
import { AdminConfigurationError } from "@/features/admin/server/environment";

export const metadata: Metadata = { title: "Администрация — BG Matura", robots: { index: false, follow: false } };

export default async function AdminPage() {
  const requestHeaders = new Headers(await headers());

  try { await requireAdmin(requestHeaders); }
  catch (error) {
    if (error instanceof AdminConfigurationError) redirect("/admin/sign-in");
    if (!(error instanceof AdminAuthorizationError)) throw error;

    // Someone who is signed in but is not an editor sees why, instead of being sent round to the sign-in page.
    const user = await getSignedInUser(requestHeaders);
    if (user === null) redirect("/admin/sign-in");
    return <section className="max-w-reading space-y-6"><h1>Администрация</h1>
      <Feedback tone="error">Нямаш достъп до администрацията. Тази част е само за одобрени редактори.</Feedback>
      <p>Влязъл си като {user.name}. Учебните материали и упражненията не изискват вход.</p>
      <AdminAuthControl mode="logout" />
    </section>;
  }
  return <section className="max-w-reading space-y-6"><h1>Администрация</h1>
    <p>Редакторският достъп е потвърден. Формулярите за съдържание се разработват отделно.</p>
    <AdminAuthControl mode="logout" />
  </section>;
}
