"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

const destinations = [
  { href: "/uchi", label: "Учи" },
  { href: "/literatura", label: "Литература" },
  { href: "/balgarski-ezik", label: "Български език" },
  { href: "/testove", label: "Тестове" },
  { href: "/matura", label: "Пробна матура" },
];

export function SiteNavigation() {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const menuButton = useRef<HTMLButtonElement>(null);

  function navigationLinks() {
    return destinations.map(({ href, label }) => {
      const current = pathname === href || pathname.startsWith(`${href}/`) || (href === "/literatura" && pathname.startsWith("/avtori/"));
      return <Link key={href} href={href} aria-current={current ? "page" : undefined}
        onClick={() => setOpenPath(null)}
        className={`inline-flex min-h-11 items-center rounded-md px-3 py-3 text-label ${href === "/matura" ? "bg-primary text-on-primary hover:bg-primary-active" : "text-ink hover:bg-surface-soft"} ${current ? "underline decoration-2 underline-offset-4" : ""}`}>
        {label}
      </Link>;
    });
  }

  return <header className="border-b border-hairline" onKeyDown={(event) => {
    if (event.key === "Escape" && open) { setOpenPath(null); menuButton.current?.focus(); }
  }}>
    <a href="#main-content" className="sr-only z-50 rounded-md bg-canvas p-4 text-primary underline focus:not-sr-only focus:absolute focus:left-4 focus:top-4">Към съдържанието</a>
    <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-4">
      <Link href="/" aria-label="BG Matura — начало" className="inline-flex min-h-11 items-center font-serif text-title text-ink">BG Matura</Link>
      <nav aria-label="Основна навигация" className="hidden items-center gap-2 md:flex">{navigationLinks()}</nav>
      <Button ref={menuButton} variant="secondary" className="md:hidden" type="button"
        aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpenPath(open ? null : pathname)}>
        {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />} Меню
      </Button>
      {open && <nav id="mobile-navigation" aria-label="Мобилна навигация" className="flex w-full flex-col gap-2 md:hidden">{navigationLinks()}</nav>}
    </div>
  </header>;
}
