"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type Account = { name: string; role: "admin" | "student" } | null;

/** `undefined` while loading or when sign-in is unavailable, so the header shows nothing rather than a wrong button. */
function useAccount(): Account | undefined {
  const [account, setAccount] = useState<Account | undefined>(undefined);
  useEffect(() => {
    let active = true;
    fetch("/api/account/me", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : undefined))
      .then((body: { user: Account } | undefined) => { if (active && body) setAccount(body.user); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  return account;
}

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

  const account = useAccount();

  async function signOut() {
    try { await fetch("/api/auth/sign-out", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: "{}" }); }
    finally { window.location.assign("/"); }
  }

  function accountControls() {
    if (account === undefined) return null;
    const linkClass = "inline-flex min-h-11 items-center rounded-md px-3 py-3 text-label text-ink hover:bg-surface-soft";
    if (account === null) return <Link href="/vhod" className={linkClass} onClick={() => setOpenPath(null)}>Вход</Link>;
    return <>
      <span className="inline-flex min-h-11 items-center px-3 text-label text-ink-muted">{account.name}</span>
      {account.role === "admin" ? <Link href="/admin" className={linkClass} onClick={() => setOpenPath(null)}>Администрация</Link> : null}
      <button type="button" className={linkClass} onClick={() => { void signOut(); }}>Изход</button>
    </>;
  }

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
      <nav aria-label="Основна навигация" className="hidden items-center gap-2 md:flex">{navigationLinks()}{accountControls()}</nav>
      <Button ref={menuButton} variant="secondary" className="md:hidden" type="button"
        aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpenPath(open ? null : pathname)}>
        {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />} Меню
      </Button>
      {open && <nav id="mobile-navigation" aria-label="Мобилна навигация" className="flex w-full flex-col gap-2 md:hidden">{navigationLinks()}{accountControls()}</nav>}
    </div>
  </header>;
}
