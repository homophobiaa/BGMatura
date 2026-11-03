import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { EditorialError } from "@/server/editorial";
import { editorialResponse, readEditorialJson } from "./http";

describe("editorial HTTP boundary", () => {
  it("accepts JSON with an explicit content type and rejects malformed or excessive bodies", async () => {
    await expect(readEditorialJson(new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: '{"name":"Тест"}' }))).resolves.toEqual({ name: "Тест" });
    for (const request of [
      new Request("http://localhost", { method: "POST", body: "{}" }),
      new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }),
      new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": "2" }, body: "x".repeat(65537) }),
      new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: new Uint8Array([0xff]) }),
    ]) await expect(readEditorialJson(request)).rejects.toBeInstanceOf(EditorialError);
  });
  it("never echoes unexpected errors, and makes successful and failed responses private", async () => {
    const response = await editorialResponse(() => Promise.reject(new Error("secret database credential")));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("secret");
    const success = await editorialResponse(() => Promise.resolve({ id: "fixture" }));
    for (const result of [response, success]) {
      expect(result.headers.get("cache-control")).toBe("private, no-store");
      expect(result.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(result.headers.get("vary")).toBe("Cookie");
    }
  });
});
