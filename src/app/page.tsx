import { ArrowRight, BookOpen, Clock, PenLine } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const choices = [
  { href: "/literatura", title: "Литература", text: "Автори, произведения и насоки за разбиране на текста.", Icon: BookOpen },
  { href: "/balgarski-ezik", title: "Български език", text: "Правила, обяснения и примери, подредени по теми.", Icon: BookOpen },
  { href: "/testove", title: "Тестове", text: "Упражнения по теми с обяснения към отговорите. В разработка.", Icon: PenLine },
  { href: "/matura", title: "Пробна матура", text: "Подготовка за работа с време и преглед на отговорите. В разработка.", Icon: Clock },
];

export default function HomePage() {
  return <div className="space-y-12 md:space-y-16">
    <section className="max-w-reading space-y-6">
      <p className="text-caption text-muted">Подготовка за ДЗИ по БЕЛ · 12. клас</p>
      <h1 className="text-display-xl">Учи с разбиране.<br />Подготви се спокойно.</h1>
      <p className="text-body-lg">BG Matura събира литература, български език и упражнения на едно място. Започни безплатно, без регистрация.</p>
      <Button asChild><Link href="/uchi">Избери какво да учиш <ArrowRight aria-hidden="true" /></Link></Button>
    </section>
    <section aria-labelledby="preparation-choices" className="space-y-6">
      <h2 id="preparation-choices">Твоята подготовка, стъпка по стъпка</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {choices.map(({ href, title, text, Icon }) => <article key={href} className="rounded-lg bg-surface-card p-4 md:p-6">
          <Icon aria-hidden="true" className="mb-4 size-6 text-primary" />
          <h3 className="text-title"><Link className="inline-flex min-h-11 items-center text-primary underline underline-offset-4" href={href}>{title}</Link></h3>
          <p className="mt-3 max-w-reading">{text}</p>
        </article>)}
      </div>
    </section>
    <section className="max-w-reading space-y-4 border-t border-hairline pt-8">
      <h2>Ясна обратна връзка</h2>
      <p>За обективните задачи подготвяме проверка с обяснение. Разширените отговори и есетата ще имат насоки за самооценка — без автоматично присъдена официална оценка.</p>
      <p className="text-caption text-muted">Платформата е в разработка. Публикуваме учебни материали след редакторска проверка.</p>
    </section>
  </div>;
}
