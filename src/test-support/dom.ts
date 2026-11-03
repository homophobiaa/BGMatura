/**
 * Fills a gap in jsdom for component tests: `CSS.escape`, which user-event uses to move
 * between the radio buttons of a group with the arrow keys. Import it first in a DOM test.
 */
if (typeof globalThis.CSS === "undefined") {
  Object.defineProperty(globalThis, "CSS", { value: {}, configurable: true });
}

if (typeof globalThis.CSS.escape !== "function") {
  globalThis.CSS.escape = (value: string) =>
    Array.from(value, (character) =>
      /[a-zA-Z0-9_-]/.test(character) || character.charCodeAt(0) > 127 ? character : `\\${character}`,
    ).join("");
}
