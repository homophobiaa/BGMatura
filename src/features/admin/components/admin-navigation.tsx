"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { learningKinds } from "@/features/learning/kinds";
import { learningKindLabels, learningListPath } from "../learning-kind-labels";

const destinations = [
  { href: "/admin", label: "Начало" },
  ...learningKinds.map((kind) => ({ href: learningListPath(kind), label: learningKindLabels[kind].plural })),
];

/** Editorial navigation. Question and exam areas are added here once their editors exist. */
export function AdminNavigation() {
  const pathname = usePathname();
  return <nav aria-label="Администрация" className="flex flex-wrap gap-2">
    {destinations.map(({ href, label }) => {
      const current = href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
      return <Link key={href} href={href} aria-current={current ? "page" : undefined}
        className={`inline-flex min-h-11 items-center rounded-md px-3 py-3 text-label text-ink hover:bg-surface-strong ${current ? "bg-surface-strong underline decoration-2 underline-offset-4" : ""}`}>
        {label}
      </Link>;
    })}
  </nav>;
}
