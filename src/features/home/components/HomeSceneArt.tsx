import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

import styles from "./home.module.css";

/**
 * Decorative line art for the homepage scenes, drawn with `ink` and `coral-decorative` on cream
 * (DESIGN.md section 6). Every piece is hidden from assistive technology and carries no text, so
 * nothing essential lives in it. Its finished state is the markup; the CSS module animates from it.
 * Ruled lines and clock marks are CSS gradients rather than elements: the markup of the whole
 * homepage has to stay small (see documentation/FEATURES/home-sequence.md, "Markup budget").
 */

/** Exposes an item's position to the CSS as `--index` for staggered timing and placement. */
function indexStyle(index: number): CSSProperties {
  // React's CSSProperties type does not list custom properties; the value is a plain number.
  return { "--index": index } as CSSProperties;
}

/** A book whose cover turns open while the title scene is pinned. */
export function BookArt() {
  return <div aria-hidden="true" className={styles.book}>
    <div className={cn(styles.page, styles.pageRight)}><span className={styles.lines} /></div>
    <div className={styles.cover}>
      <div className={cn(styles.face, styles.coverFront)} />
      <div className={cn(styles.face, styles.coverBack)}><span className={styles.lines} /></div>
    </div>
    <span className={styles.ribbon} />
  </div>;
}

/** An open spread: Bulgarian glyphs settle on both pages, lines are written, and a page turns. */
export function SpreadArt() {
  return <div aria-hidden="true" className={styles.spread}>
    <div className={cn(styles.page, styles.pageLeft, styles.glyphLeft)}><span className={styles.lines} /></div>
    <div className={cn(styles.page, styles.pageRight, styles.glyphRight)}><span className={styles.lines} /></div>
    <div className={styles.turningPage}>
      <div className={cn(styles.face, styles.turningFront)} />
      <div className={cn(styles.face, styles.turningBack)} />
    </div>
  </div>;
}

/** Answer options; the selection travels between them and settles with a check. */
export function OptionsArt() {
  return <div aria-hidden="true" className={styles.options}>
    {[0, 1, 2].map((index) => <span key={index} className={styles.option} style={indexStyle(index)} />)}
    <span className={styles.selection} />
  </div>;
}

/** A clock face whose hand sweeps once while the exam scene is pinned. */
export function ClockArt() {
  return <div aria-hidden="true" className={styles.clock}><span className={styles.hand} /></div>;
}
