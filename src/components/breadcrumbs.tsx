import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return <nav aria-label="Път до страницата"><ol className="flex flex-wrap items-center gap-2 text-caption">
    {items.map((item, index) => <li key={`${index}-${item.label}`} className="flex min-w-0 items-center gap-2 [overflow-wrap:anywhere]">
      {index > 0 && <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />}
      {item.href ? <Link href={item.href} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">{item.label}</Link> :
        <span aria-current="page" className="text-muted">{item.label}</span>}
    </li>)}
  </ol></nav>;
}
