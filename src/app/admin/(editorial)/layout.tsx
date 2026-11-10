import type { ReactNode } from "react";
import { AdminAuthControl } from "@/features/admin/components/auth-controls";
import { AdminNavigation } from "@/features/admin/components/admin-navigation";
import { requireAdminPage } from "@/features/admin/server/page-authorization";

/** Editorial shell. Each page still authorizes itself; this layout adds identity and navigation. */
export default async function EditorialLayout({ children }: { children: ReactNode }) {
  const { admin } = await requireAdminPage();
  return <div className="space-y-8">
    <header className="space-y-4 rounded-lg bg-surface-soft p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-label text-primary">Редакторски режим</p>
          <p className="text-caption text-muted [overflow-wrap:anywhere]">Влязъл: {admin.name || admin.email} ({admin.email})</p>
        </div>
        <AdminAuthControl mode="logout" />
      </div>
      <AdminNavigation />
    </header>
    {children}
  </div>;
}
