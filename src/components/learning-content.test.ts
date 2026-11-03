import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LearningContent, StudyText } from "./learning-content";

describe("educational content renderer", () => {
  it("escapes markup in text, attributes, lists, examples, quotes, and link labels", () => {
    const malicious = '<script>alert("secret")</script><img src=x onerror=alert(1)>';
    const inline = [{ type: "text", text: malicious }];
    const html = renderToStaticMarkup(createElement(LearningContent, { content: { version: 1, blocks: [
      { type: "heading", level: 2, text: malicious },
      { type: "paragraph", content: inline },
      { type: "list", ordered: false, items: [inline] },
      { type: "example", title: malicious, content: inline },
      { type: "quotation", content: inline, attribution: malicious },
      { type: "paragraph", content: [{ type: "link", text: malicious, href: "https://example.test" }] },
    ] } }));
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    for (const element of ["h2", "ul", "blockquote", "figcaption", "aside"]) expect(html).toContain(`<${element}`);
    expect(html).toContain('href="https://example.test"');
    expect(renderToStaticMarkup(createElement(StudyText, { text: malicious }))).not.toContain("<script>");
  });

  it.each([
    { version: 1, blocks: [] },
    { version: 2, blocks: [] },
    { version: 1, blocks: [{ type: "html", html: "<img src=x onerror=alert(1)>" }] },
    { version: 1, blocks: [{ type: "paragraph", content: [{ type: "link", text: "bad", href: "javascript:alert(1)" }] }] },
  ])("fails closed on empty or malicious stored content", (content) => {
    const html = renderToStaticMarkup(createElement(LearningContent, { content }));
    expect(html).toContain("Материалът временно не е достъпен.");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<img");
  });
});
