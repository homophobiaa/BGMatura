import Link from "next/link";

export function SiteFooter() {
  return <footer className="mt-16 border-t border-hairline bg-surface-soft">
    <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-12 md:grid-cols-2">
      <div className="space-y-3"><p className="font-serif text-title text-ink">BG Matura</p>
        <p className="max-w-reading">Безплатна подготовка по БЕЛ, без задължителна регистрация.</p>
        <p className="text-caption text-muted">Независим учебен проект. Не е официална платформа на МОН.</p>
      </div>
      <nav aria-label="Полезни връзки" className="flex flex-wrap content-start items-start gap-2">
        {[
          { href: "/literatura", label: "Литература" },
          { href: "/balgarski-ezik", label: "Български език" },
          { href: "/za-proekta", label: "За проекта" },
          { href: "/admin/sign-in", label: "Вход за редактори" },
        ].map(({ href, label }) =>
          <Link key={href} href={href} className="inline-flex min-h-11 items-center rounded-md px-3 py-3 text-primary underline underline-offset-4">{label}</Link>)}
      </nav>
    </div>
  </footer>;
}
