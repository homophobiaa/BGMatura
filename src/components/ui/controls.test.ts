import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { Button } from "./button";
import { Input } from "./input";
import { Feedback } from "./feedback";

it("communicates busy, disabled, pressed, and error states without colour alone", () => {
  const busy = renderToStaticMarkup(createElement(Button, { busy: true }, "Запази"));
  expect(busy).toContain('disabled=""');
  expect(busy).toContain('aria-busy="true"');
  expect(busy).toContain("Зареждане…");
  expect(renderToStaticMarkup(createElement(Button, { disabled: true }, "Запази"))).toContain('disabled=""');
  expect(renderToStaticMarkup(createElement(Button, { "aria-pressed": true }, "Избор"))).toContain('aria-pressed="true"');
  expect(renderToStaticMarkup(createElement(Input, { id: "title", "aria-invalid": true, "aria-describedby": "title-error" }))).toContain('aria-describedby="title-error"');
  const error = renderToStaticMarkup(createElement(Feedback, { tone: "error", id: "title-error", children: "Въведи заглавие." }));
  expect(error).toContain('role="alert"');
  expect(error).toContain("Грешка:");
  expect(error).toContain("Въведи заглавие.");
});
