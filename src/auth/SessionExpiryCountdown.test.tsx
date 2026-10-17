import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/test-utils";
import i18n from "../i18n";
import SessionExpiryCountdown from "./SessionExpiryCountdown";
import tokenStorage from "./tokenStorage";

const mocks = vi.hoisted(() => ({
  logoutAndRedirect: vi.fn<(options?: { reason?: "sessionExpired" }) => Promise<void>>(),
}));

vi.mock("./authService", () => ({
  logoutAndRedirect: mocks.logoutAndRedirect,
}));

const NOW = new Date("2026-10-17T14:13:00").getTime();

/** Ogohlantirish allaqachon boshlangan, tugashiga 1:58 qoldi (maket `tizim-feedback` 04). */
const startWarning = (remainingMs = 118_000) => {
  tokenStorage.setSessionMetadata({
    refreshTokenWarnAt: NOW - 60_000,
    refreshTokenExpiresAt: NOW + remainingMs,
  });
};

describe("SessionExpiryCountdown (dizayn v2: tizim-feedback «Sessiya» bannerlari)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mocks.logoutAndRedirect.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    // Avval o'chiriladi: metama'lumot hodisasi o'rnatilgan komponentni `act` dan tashqarida yangilamasin.
    cleanup();
    vi.useRealTimers();
    tokenStorage.clearSessionMetadata();
    document.querySelectorAll("[data-shell-slot=topbar]").forEach((node) => node.remove());
    await i18n.changeLanguage("uz");
  });

  it("is hidden before warnAt and without session metadata", () => {
    renderWithProviders(<SessionExpiryCountdown />, { route: "/orders" });
    expect(document.querySelector("[data-session-banner]")).toBeNull();

    act(() => {
      tokenStorage.setSessionMetadata({ refreshTokenWarnAt: NOW + 60_000, refreshTokenExpiresAt: NOW + 960_000 });
    });
    expect(document.querySelector("[data-session-banner]")).toBeNull();

    // Ogohlantirish vaqti kelganda o'zi chiqadi.
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(screen.getByRole("status")).toHaveAttribute("data-session-banner", "warning");
  });

  it("warning banner: mockup texts, a polite status and a silent mm:ss timer", () => {
    startWarning();
    renderWithProviders(<SessionExpiryCountdown />, { route: "/orders" });

    const banner = screen.getByRole("status");
    expect(banner).toHaveAttribute("data-session-banner", "warning");
    expect(banner).toHaveTextContent("Sessiya 2 daqiqadan keyin tugaydi.");
    expect(banner).toHaveTextContent("Ochiq formani saqlab qo'ying — keyin qayta kirish kerak bo'ladi.");

    const timer = screen.getByRole("timer", { name: "Sessiya tugashiga 1 daqiqa 58 soniya qoldi" });
    expect(timer).toHaveTextContent("01:58");
    expect(timer).toHaveAttribute("aria-live", "off");

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByRole("timer")).toHaveTextContent("00:58");
    expect(screen.getByRole("status")).toHaveTextContent("Sessiya 1 daqiqadan keyin tugaydi.");
    expect(mocks.logoutAndRedirect).not.toHaveBeenCalled();
  });

  it("expired banner: alert + «Qayta kirish»; the next pointer logs out once with the sessionExpired reason", () => {
    startWarning(2_000);
    renderWithProviders(<SessionExpiryCountdown />, { route: "/orders" });

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    const banner = screen.getByRole("alert");
    expect(banner).toHaveAttribute("data-session-banner", "expired");
    expect(banner).toHaveTextContent("Sessiya tugadi.");
    expect(banner).toHaveTextContent("Davom ettirish uchun qayta kiring.");
    const relogin = screen.getByRole("button", { name: "Qayta kirish" });

    // Tugmani bosish: avval `pointerdown` (ushlab olinadi), keyin `click` — chiqish bir marta.
    fireEvent.pointerDown(relogin);
    fireEvent.click(relogin);

    expect(mocks.logoutAndRedirect).toHaveBeenCalledTimes(1);
    expect(mocks.logoutAndRedirect).toHaveBeenCalledWith({ reason: "sessionExpired" });
  });

  it("expired: a key press anywhere also logs out", () => {
    startWarning(1_000);
    renderWithProviders(<SessionExpiryCountdown />, { route: "/orders" });
    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    fireEvent.keyDown(window, { key: "Tab" });

    expect(mocks.logoutAndRedirect).toHaveBeenCalledWith({ reason: "sessionExpired" });
  });

  it("the button alone (screen reader click without pointerdown) logs out too", () => {
    startWarning(1_000);
    renderWithProviders(<SessionExpiryCountdown />, { route: "/orders" });
    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    fireEvent.click(screen.getByRole("button", { name: "Qayta kirish" }));

    expect(mocks.logoutAndRedirect).toHaveBeenCalledTimes(1);
    expect(mocks.logoutAndRedirect).toHaveBeenCalledWith({ reason: "sessionExpired" });
  });

  it("is not shown on /login and does not log out there", () => {
    startWarning(1_000);
    renderWithProviders(<SessionExpiryCountdown />, { route: "/login" });
    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    expect(document.querySelector("[data-session-banner]")).toBeNull();
    fireEvent.pointerDown(document.body);
    expect(mocks.logoutAndRedirect).not.toHaveBeenCalled();
  });

  it("sits under the shell top bar, in its column (the sidebar stays uncovered)", () => {
    const topbar = document.createElement("div");
    topbar.setAttribute("data-shell-slot", "topbar");
    topbar.getBoundingClientRect = () =>
      ({ top: 0, bottom: 64, left: 248, right: 1440, width: 1192, height: 64, x: 248, y: 0 }) as DOMRect;
    document.body.appendChild(topbar);
    startWarning();

    renderWithProviders(<SessionExpiryCountdown />, { route: "/orders" });

    const banner = screen.getByRole("status");
    expect(banner).toHaveClass("fixed");
    expect(banner.style.position).toBe("");
    expect(banner.style.top).toBe("64px");
    expect(banner.style.left).toBe("248px");
    expect(banner.style.width).toBe("1192px");
  });

  it("without a top bar (scan shell) it is in the flow, sticky at the top: it pushes the page down", () => {
    startWarning();
    renderWithProviders(<SessionExpiryCountdown />, { route: "/scan" });

    const banner = screen.getByRole("status");
    expect(banner).toHaveClass("inset-x-0", "top-0");
    expect(banner.style.position).toBe("sticky");
    expect(banner.style.top).toBe("");
    expect(banner.style.left).toBe("");
    expect(banner.style.width).toBe("");
  });

  it("russian plural forms", async () => {
    await i18n.changeLanguage("ru");
    startWarning(5 * 60_000);
    renderWithProviders(<SessionExpiryCountdown />, { route: "/orders" });

    expect(screen.getByRole("status")).toHaveTextContent("Сессия истечёт через 5 минут.");
  });
});
