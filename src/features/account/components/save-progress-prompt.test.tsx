// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SaveProgressPrompt } from "./save-progress-prompt";

const attemptId = "6f1c2f9e-2a53-4f0e-9a33-5d1f0e2b7a10";
const fetchMock = vi.fn();

function answerWith(user: { name: string; role: string } | null, ok = true) {
  fetchMock.mockImplementation((url: string) => Promise.resolve(
    url === "/api/account/me"
      ? { ok, json: () => Promise.resolve({ user }) }
      : { ok: true, json: () => Promise.resolve({ claimed: true }) },
  ));
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  window.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function show() {
  return render(<SaveProgressPrompt attemptId={attemptId} returnTo="/istoriya/abc?x=1" />);
}

describe("SaveProgressPrompt", () => {
  it("offers a visitor to sign in, says what is kept and that the result stays in this browser, and does not take focus", async () => {
    answerWith(null);
    show();
    expect(await screen.findByRole("heading", { name: "Запази прогреса" })).toBeTruthy();
    expect(screen.getByText(/остава достъпен в този браузър и без профил/)).toBeTruthy();
    expect(screen.getByText(/Пазим само името и имейла от Google/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Влез и запази" }).getAttribute("href")).toBe("/vhod?next=%2Fistoriya%2Fabc%3Fx%3D1");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it("is dismissed with Не сега and stays dismissed for the session", async () => {
    answerWith(null);
    const first = show();
    await userEvent.click(await screen.findByRole("button", { name: "Не сега" }));
    expect(screen.queryByRole("heading", { name: "Запази прогреса" })).toBeNull();
    first.unmount();

    show();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole("heading", { name: "Запази прогреса" })).toBeNull();
  });

  it("never appears for a signed-in student, and links the finished attempt to the account", async () => {
    answerWith({ name: "Мария", role: "student" });
    show();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/attempts/${attemptId}`, expect.objectContaining({ method: "POST", body: JSON.stringify({ operation: "claim" }) })));
    expect(screen.queryByRole("heading", { name: "Запази прогреса" })).toBeNull();
  });

  it("shows nothing when sign-in is unavailable or the network fails", async () => {
    answerWith(null, false);
    const unavailable = show();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole("heading", { name: "Запази прогреса" })).toBeNull();
    unavailable.unmount();

    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new Error("offline"));
    show();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole("heading", { name: "Запази прогреса" })).toBeNull();
  });

  it("still works when browser storage is blocked", async () => {
    answerWith(null);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    show();
    await userEvent.click(await screen.findByRole("button", { name: "Не сега" }));
    expect(screen.queryByRole("heading", { name: "Запази прогреса" })).toBeNull();
    vi.restoreAllMocks();
  });
});
