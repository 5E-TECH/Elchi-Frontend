import { fireEvent, screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/test-utils";
import i18n from "../i18n";
import uzAuth from "../locales/uz/auth.json";
import ruAuth from "../locales/ru/auth.json";
import enAuth from "../locales/en/auth.json";
import SessionRestoreScreen from "./SessionRestoreScreen";
import type { SessionRestoreState } from "../entities/user/model/types";

/**
 * «Internet sekin — qayta urinilmoqda» ekrani (sekin internet, 2026-11-07): yangi tab / PWA ochilishida sessiyani
 * tiklash sekin yoki vaqtincha yiqilganda yuklanish ekrani o'rnida (`GlobalLoader`).
 */
const mocks = vi.hoisted(() => ({
  retrySessionRestoreNow: vi.fn(),
  abandonSessionRestore: vi.fn(),
}));

vi.mock("./authService", () => ({
  retrySessionRestoreNow: mocks.retrySessionRestoreNow,
  abandonSessionRestore: mocks.abandonSessionRestore,
}));

const renderScreen = (state: SessionRestoreState) =>
  renderWithProviders(
    <Routes>
      <Route path="/" element={<SessionRestoreScreen state={state} />} />
      <Route path="/login" element={<p>Kirish formasi</p>} />
    </Routes>,
    { route: "/" },
  );

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

beforeEach(() => {
  mocks.retrySessionRestoreNow.mockClear();
  mocks.abandonSessionRestore.mockClear();
});

describe("SessionRestoreScreen", () => {
  it("tarmoq, kutish — sarlavha, «hisobdan chiqmadingiz», ikkala tugma; «Qayta urinish» darhol urinadi", () => {
    renderScreen({ phase: "waiting", reason: "network" });

    expect(screen.getByRole("heading", { level: 1, name: "Internet sekin — qayta urinilmoqda" })).toBeInTheDocument();
    expect(screen.getByText("Hisobingizdan chiqmadingiz. Aloqa tiklanishi bilan ilova o'zi ochiladi.")).toBeInTheDocument();
    expect(screen.getByText("Ulanib bo'lmadi — birozdan keyin yana urinamiz.")).toHaveAttribute("aria-live", "polite");

    const retry = screen.getByRole("button", { name: "Qayta urinish" });
    expect(retry).not.toHaveAttribute("aria-busy");
    fireEvent.click(retry);
    expect(mocks.retrySessionRestoreNow).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Kirish sahifasiga o'tish" })).toBeInTheDocument();
  });

  it("server (429 / 5xx) — «Server javob bermayapti» sarlavhasi", () => {
    renderScreen({ phase: "waiting", reason: "server" });
    expect(
      screen.getByRole("heading", { level: 1, name: "Server javob bermayapti — qayta urinilmoqda" }),
    ).toBeInTheDocument();
  });

  it.each(["slow", "retrying"] as const)("%s — urinish ketmoqda: «Qayta urinish» band, bosilmaydi, «Ulanmoqda…»", (phase) => {
    renderScreen({ phase, reason: "network" });
    const retry = screen.getByRole("button", { name: "Qayta urinish" });
    expect(retry).toHaveAttribute("aria-busy", "true");
    fireEvent.click(retry);
    expect(mocks.retrySessionRestoreNow).not.toHaveBeenCalled();
    expect(screen.getByText("Ulanmoqda…")).toBeInTheDocument();
  });

  it("«Kirish sahifasiga o'tish» — qayta urinishlar to'xtaydi va kirish formasi ochiladi", () => {
    renderScreen({ phase: "slow", reason: "network" });
    fireEvent.click(screen.getByRole("button", { name: "Kirish sahifasiga o'tish" }));
    expect(mocks.abandonSessionRestore).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Kirish formasi")).toBeInTheDocument();
  });

  it("dizayn v2: yuklanish ekrani qobig'i (navy, logotip), karta tokenlarda — hex / palitra klassi yo'q", () => {
    const { container } = renderScreen({ phase: "waiting", reason: "network" });
    const shell = container.querySelector(".fixed");
    expect(shell).toHaveClass("inset-0", "bg-nav");
    expect(screen.getByRole("img", { name: "Elchi Pochta" })).toBeInTheDocument();
    const card = screen.getByRole("region", { name: "Internet sekin — qayta urinilmoqda" });
    expect(card).toHaveClass("bg-surface", "border-border");
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,6}\b|\b(?:bg|text)-(?:red|green|blue|gray|slate|yellow)-\d/i);
  });
});

describe("sessionRestore tarjimalari", () => {
  const KEYS = ["title", "titleServer", "text", "trying", "waiting", "retry", "toLogin"] as const;

  it.each([
    ["uz", uzAuth],
    ["ru", ruAuth],
    ["en", enAuth],
  ])("%s — 7 kalit ham bor va bo'sh emas", (_lang, bundle) => {
    const block = (bundle as { sessionRestore?: Record<string, string> }).sessionRestore ?? {};
    for (const key of KEYS) expect(block[key]?.trim(), key).toBeTruthy();
  });

  it("ru — kirill yozuvida; uz sarlavha — egasi so'ragan matn", () => {
    for (const value of Object.values(ruAuth.sessionRestore)) expect(value).toMatch(/[А-Яа-яЁё]/);
    expect(uzAuth.sessionRestore.title).toBe("Internet sekin — qayta urinilmoqda");
  });
});
