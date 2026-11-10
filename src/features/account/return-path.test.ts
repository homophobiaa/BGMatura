import { describe, expect, it } from "vitest";

import { safeReturnPath } from "./return-path";

describe("safeReturnPath", () => {
  it.each([
    "/",
    "/uchi",
    "/literatura/pod-igoto",
    "/testove?tema=gramatika",
    "/literatura?q=%D0%B2%D0%B0%D0%B7%D0%BE%D0%B2#rezultati",
    "/balgarski-ezik/pravopis",
  ])("keeps the site path %s", (path) => {
    expect(safeReturnPath(path)).toBe(path);
  });

  it.each([
    ["nothing", undefined],
    ["an empty value", ""],
    ["a list of values", ["/uchi", "/matura"]],
    ["another website", "https://evil.example/uchi"],
    ["a protocol-relative address", "//evil.example"],
    ["a backslash trick", "/\\evil.example"],
    ["a scripting address", "javascript:alert(1)"],
    ["a data address", "data:text/html,x"],
    ["a path with a line break", "/uchi\r\nSet-Cookie: x=1"],
    ["a path with a space before a colon", "/ https://evil.example"],
    ["a relative path", "uchi"],
    ["a very long path", `/${"a".repeat(300)}`],
  ])("falls back to the home page for %s", (_description, value) => {
    expect(safeReturnPath(value)).toBe("/");
  });

  it.each(["/vhod", "/vhod?next=/uchi", "/registraciya", "/api/auth/sign-out", "/api/account/me", "/vhod/anything"])(
    "does not send a student back into the sign-in page or an API: %s",
    (path) => {
      expect(safeReturnPath(path)).toBe("/");
    },
  );

  it("still allows paths that merely start with the same letters", () => {
    expect(safeReturnPath("/vhodove")).toBe("/vhodove");
    expect(safeReturnPath("/apiary")).toBe("/apiary");
  });
});
