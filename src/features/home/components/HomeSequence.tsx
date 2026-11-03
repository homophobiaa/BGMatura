import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { BookArt, ClockArt, OptionsArt, SpreadArt } from "./HomeSceneArt";
import styles from "./home.module.css";

/**
 * The homepage as a sequence of five scenes. The markup is the finished, readable page: without
 * JavaScript, with reduced motion, or without CSS scroll-driven animations it is a plain stack of
 * sections. `home.module.css` adds the pinned, scroll-scrubbed version on top of it.
 * Choreography and the reasons behind it: documentation/FEATURES/home-sequence.md.
 */

const sceneLinks = [
  { href: "#literatura", label: "Литература" },
  { href: "#balgarski-ezik", label: "Български език" },
  { href: "#testove", label: "Тестове" },
  { href: "#probna-matura", label: "Пробна матура" },
];

function PrimaryAction() {
  return <Button asChild><Link href="/uchi">Избери какво да учиш <ArrowRight aria-hidden="true" /></Link></Button>;
}

function Scene({ className, labelledBy, children, art }: { className: string | undefined; labelledBy: string; children: ReactNode; art: ReactNode }) {
  return <section aria-labelledby={labelledBy} className={cn(styles.scene, className)}>
    <div className={styles.stage}>
      <div className={styles.copy}>{children}</div>
      <div className={styles.art}>{art}</div>
    </div>
  </section>;
}

/** Position in a scene's reveal sequence: earlier items arrive first. */
const revealOrder = { 0: styles.order0, 1: styles.order1, 2: styles.order2 } as const;

/**
 * A learning path. Its reveal and exit live in the `card` class itself; only the second card
 * of a scene needs a later place in the reveal order.
 */
function PathCard({ id, href, title, text, later = false }: { id: string; href: string; title: string; text: string; later?: boolean }) {
  return <article id={id} aria-labelledby={`${id}-title`} className={cn(styles.card, later && revealOrder[2])}>
    <h3 id={`${id}-title`} className="text-title"><Link className={styles.link} href={href}>{title}</Link></h3>
    <p className="mt-3 max-w-reading">{text}</p>
  </article>;
}

export function HomeSequence() {
  return <div className={styles.sequence}>
    <Scene className={styles.sceneTitle} labelledBy="home-title" art={<BookArt />}>
      <p className={cn(styles.leave, "text-caption text-muted")}>Подготовка за ДЗИ по БЕЛ · 12. клас</p>
      <h1 id="home-title" className="text-display-xl">
        <span className={cn(styles.titleLine, styles.splitLeft)}>Учи с разбиране.</span>{" "}
        <span className={cn(styles.titleLine, styles.splitRight)}>Подготви се спокойно.</span>
      </h1>
      <p className={cn(styles.leave, "max-w-reading text-body-lg")}>BG Matura събира литература, български език и упражнения на едно място. Започни безплатно, без регистрация.</p>
      <div className={styles.leave}><PrimaryAction /></div>
      <nav aria-labelledby="preparation-choices" className={cn(styles.leave, "space-y-2")}>
        <h2 id="preparation-choices" className="font-sans text-label text-ink">Твоята подготовка, стъпка по стъпка</h2>
        <ul className={styles.sceneLinks}>
          {sceneLinks.map(({ href, label }) => <li key={href}><a className={styles.link} href={href}>{label}</a></li>)}
        </ul>
      </nav>
    </Scene>

    <Scene className={styles.sceneLearn} labelledBy="uchi-label" art={<SpreadArt />}>
      <p id="uchi-label" className={cn(styles.reveal, styles.leave, revealOrder[0], "text-caption text-muted")}>Учи</p>
      <div className="grid gap-4 md:grid-cols-2">
        <PathCard id="literatura" href="/literatura" title="Литература"
          text="Автори, произведения и насоки за разбиране на текста." />
        <PathCard id="balgarski-ezik" later href="/balgarski-ezik" title="Български език"
          text="Правила, обяснения и примери, подредени по теми." />
      </div>
    </Scene>

    <Scene className={styles.scenePractice} labelledBy="testove-title" art={<OptionsArt />}>
      <PathCard id="testove" href="/testove" title="Тестове"
        text="Упражнения по теми с обяснения към отговорите. В разработка." />
    </Scene>

    <Scene className={styles.sceneExam} labelledBy="probna-matura-title" art={<ClockArt />}>
      <PathCard id="probna-matura" href="/matura" title="Пробна матура"
        text="Подготовка за работа с време и преглед на отговорите. В разработка." />
    </Scene>

    <Scene className={styles.sceneStart} labelledBy="start-title" art={null}>
      <h2 id="start-title" className={cn(styles.reveal, revealOrder[0], styles.underlined, "text-display-lg")}>Започни безплатно, без регистрация.</h2>
      <div className={cn(styles.reveal, revealOrder[1])}><PrimaryAction /></div>
    </Scene>
  </div>;
}
