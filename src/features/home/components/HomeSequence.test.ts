// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HomeSequence } from "./HomeSequence";

const markup = renderToStaticMarkup(createElement(HomeSequence));
const document = new DOMParser().parseFromString(markup, "text/html");
// Line endings depend on the checkout (Git on Windows may write CRLF).
const stylesheet = readFileSync(join(import.meta.dirname, "home.module.css"), "utf8")
  .replaceAll("\r\n", "\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");

function textOf(selector: string): string[] {
  return Array.from(document.querySelectorAll(selector), (element) => element.textContent?.trim() ?? "");
}

describe("HomeSequence content", () => {
  it("keeps the scenes in reading order and ends on the primary call to action", () => {
    expect(textOf("h1")).toEqual(["Учи с разбиране. Подготви се спокойно."]);
    expect(textOf("h3")).toEqual(["Литература", "Български език", "Тестове", "Пробна матура"]);
    const headings = textOf("h1, h2, h3");
    expect(headings.at(-1)).toBe("Започни безплатно, без регистрация.");
    const lastLink = Array.from(document.querySelectorAll("a")).at(-1);
    expect(lastLink?.getAttribute("href")).toBe("/uchi");
    expect(lastLink?.textContent).toBe("Избери какво да учиш ");
  });

  it("links every learning path to its page", () => {
    const links = Object.fromEntries(Array.from(document.querySelectorAll("h3 a"), (link) => [link.textContent, link.getAttribute("href")]));
    expect(links).toEqual({ "Литература": "/literatura", "Български език": "/balgarski-ezik", "Тестове": "/testove", "Пробна матура": "/matura" });
  });

  it("reaches every scene without scrolling through the others", () => {
    const anchors = Array.from(document.querySelectorAll('nav[aria-labelledby="preparation-choices"] a'));
    expect(anchors.map((anchor) => anchor.textContent)).toEqual(["Литература", "Български език", "Тестове", "Пробна матура"]);
    for (const anchor of anchors) {
      const target = document.getElementById(anchor.getAttribute("href")?.slice(1) ?? "");
      expect(target?.querySelector("h3")?.textContent).toBe(anchor.textContent);
    }
  });

  it("states free access without registration and shows no statistics", () => {
    const text = document.body.textContent ?? "";
    expect(text).toContain("Започни безплатно, без регистрация.");
    // The only number on the page is the school year in the approved introduction.
    expect(text.match(/\d+/g)).toEqual(["12"]);
  });

  it("keeps the drawings decorative: hidden from assistive technology and without text", () => {
    const drawings = document.querySelectorAll('[aria-hidden="true"]:not(svg)');
    expect(drawings).toHaveLength(4);
    for (const drawing of drawings) expect(drawing.textContent).toBe("");
  });
});

describe("home.module.css motion guard", () => {
  const guard = "@media (prefers-reduced-motion: no-preference) and (min-height: 34rem) {\n  @supports (animation-timeline: view()) {";
  const guardStart = stylesheet.indexOf(guard);
  const guardEnd = stylesheet.indexOf("\n}\n", guardStart);

  it("pins and animates only inside the reduced-motion and support guard", () => {
    expect(guardStart).toBeGreaterThan(-1);
    for (const property of ["position: sticky", "view-timeline", "animation-timeline", "animation:", "animation-name"]) {
      const outside = stylesheet.slice(0, guardStart) + stylesheet.slice(guardEnd);
      expect(outside, property).not.toContain(property);
    }
  });

  it("animates only compositor-friendly properties", () => {
    const keyframes = stylesheet.slice(guardEnd).match(/@keyframes [\w-]+ \{[\s\S]*?\n\}/g) ?? [];
    expect(keyframes.length).toBeGreaterThan(0);
    // content-visibility and pointer-events are discrete switches, not values that change every frame.
    const allowed = new Set(["opacity", "translate", "scale", "rotate", "transform", "clip-path", "content-visibility", "pointer-events", "animation-timing-function"]);
    for (const block of keyframes) {
      for (const [, property] of block.matchAll(/([a-z-]+):/g)) expect(allowed, `${block.split(" {")[0]}: ${property}`).toContain(property);
    }
  });

  it("holds the stage against the scroll with linear timing only", () => {
    const stageRule = stylesheet.slice(guardStart).match(/\n {4}\.stage \{[\s\S]*?\n {4}\}/)?.[0] ?? "";
    expect(stageRule).toContain("animation-name: hold-in, hold-out;");
    expect(stageRule).toContain("animation-timing-function: linear, linear;");
  });
});
