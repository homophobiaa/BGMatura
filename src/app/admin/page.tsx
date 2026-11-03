import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminAuthControl } from "@/features/admin/components/auth-controls";
import { AdminAuthorizationError, requireAdmin } from "@/features/admin/server/authorization";
import { AdminConfigurationError } from "@/features/admin/server/environment";

export const metadata: Metadata = { title: "Администрация — BG Matura", robots: { index: false, follow: false } };

export default async function AdminPage() {
  try { await requireAdmin(new Headers(await headers())); }
  catch (error) {
    if (error instanceof AdminAuthorizationError || error instanceof AdminConfigurationError) redirect("/admin/sign-in");
    throw error;
  }
  return <section className="max-w-reading space-y-6"><h1>Администрация</h1>
    <p>Редакторският достъп е потвърден. Формулярите за съдържание се разработват отделно.</p>
    <AdminAuthControl mode="logout" />
  </section>;
}
