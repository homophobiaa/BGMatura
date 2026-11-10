import { describe, expect, it } from "vitest";
import { fieldMessages, translateEditorialMessage } from "./editorial-messages";

describe("editorial messages", () => {
  it("translates known service messages", () => {
    expect(translateEditorialMessage("Publish the author first.")).toBe("Първо публикувай автора.");
  });

  it("keeps messages that are already Bulgarian", () => {
    expect(translateEditorialMessage("Нямаш достъп до администрацията.")).toBe("Нямаш достъп до администрацията.");
  });

  it("replaces unknown English text with a general hint", () => {
    expect(translateEditorialMessage("Too small: expected string to have >=1 characters")).toBe("Провери стойността на това поле.");
  });

  it("collects nested field paths once", () => {
    const fields = { themes: ["Add at least one key theme."], "themes.1": ["Invalid input"], "themes.2": ["Invalid input"], title: ["Write the work title."] };
    expect(fieldMessages(fields, "themes")).toEqual(["Добави поне една тема.", "Провери стойността на това поле."]);
    expect(fieldMessages(fields, "them")).toEqual([]);
  });
});
