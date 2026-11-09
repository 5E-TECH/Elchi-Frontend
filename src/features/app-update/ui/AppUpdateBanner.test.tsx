import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import i18n from "../../../i18n";
import tokenStorage from "../../../auth/tokenStorage";
import { setShellBannerSlot } from "../../../shared/lib/shellBannerSlot";
import { APP_UPDATE_MIN_GAP_MS, APP_UPDATE_POLL_MS } from "../model/useAppUpdateAvailable";
import AppUpdateBanner from "./AppUpdateBanner";

const NOW = new Date("2026-11-08T10:00:00").getTime();

let visibility: DocumentVisibilityState = "visible";
const reload = vi.fn();
let slotCleanup: (() => void) | undefined;

/** Ilovaga qaytish (telefonda fondan ochish / kompyuterda tabga qaytish). */
const returnToApp = async () => {
  visibility = "visible";
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
};

const advance = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

const banner = () => document.querySelector("[data-update-banner]");

describe("AppUpdateBanner (ochiq ilovaga yangi versiya chiqsa)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    visibility = "visible";
    reload.mockReset();
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload } as Location);
  });

  afterEach(async () => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    tokenStorage.clearSessionMetadata();
    slotCleanup?.();
    slotCleanup = undefined;
    document.querySelectorAll("[data-shell-slot=banner]").forEach((node) => node.remove());
    await i18n.changeLanguage("uz");
  });

  it("checks when the user returns to the app and shows the banner with «Yangilash»", async () => {
    const check = vi.fn(async () => true);
    renderWithProviders(<AppUpdateBanner enabled check={check} />, { route: "/orders" });

    // Sahifa hozirgina yuklangan — eng yangi versiya: birinchi daqiqada server so'ralmaydi.
    await returnToApp();
    expect(check).not.toHaveBeenCalled();
    expect(banner()).toBeNull();

    await advance(APP_UPDATE_MIN_GAP_MS);
    await returnToApp();
    expect(check).toHaveBeenCalledTimes(1);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("data-update-banner");
    expect(status).toHaveTextContent("Ilovaning yangi versiyasi chiqdi.");
    expect(status).toHaveTextContent("Ochiq formani saqlab, keyin yangilang.");

    fireEvent.click(screen.getByRole("button", { name: "Yangilash" }));
    expect(reload).toHaveBeenCalledTimes(1);

    // Topilgach kuzatuv to'xtaydi.
    await advance(APP_UPDATE_POLL_MS * 2);
    await returnToApp();
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("polls every 5 minutes while visible, never in a hidden tab", async () => {
    const check = vi.fn(async () => false);
    renderWithProviders(<AppUpdateBanner enabled check={check} />, { route: "/orders" });

    visibility = "hidden";
    await advance(APP_UPDATE_POLL_MS);
    expect(check).not.toHaveBeenCalled();

    visibility = "visible";
    await advance(APP_UPDATE_POLL_MS);
    expect(check).toHaveBeenCalledTimes(1);
    expect(banner()).toBeNull();

    // Kompyuterda boshqa oynadan qaytish ham — lekin 1 daqiqadan tez emas.
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(check).toHaveBeenCalledTimes(1);
    await advance(APP_UPDATE_MIN_GAP_MS);
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("ignores a failed check and retries on the next return", async () => {
    const check = vi.fn<() => Promise<boolean>>().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(true);
    renderWithProviders(<AppUpdateBanner enabled check={check} />, { route: "/orders" });

    await advance(APP_UPDATE_MIN_GAP_MS);
    await returnToApp();
    expect(banner()).toBeNull();

    await advance(APP_UPDATE_MIN_GAP_MS);
    await returnToApp();
    expect(banner()).not.toBeNull();
  });

  it("does nothing when disabled (dev build)", async () => {
    const check = vi.fn(async () => true);
    renderWithProviders(<AppUpdateBanner enabled={false} check={check} />, { route: "/orders" });
    await advance(APP_UPDATE_POLL_MS * 3);
    await returnToApp();
    expect(check).not.toHaveBeenCalled();
  });

  it("goes into the shell banner slot, under the top bar", async () => {
    const slot = document.createElement("div");
    slot.setAttribute("data-shell-slot", "banner");
    document.body.appendChild(slot);
    slotCleanup = setShellBannerSlot(slot);

    renderWithProviders(<AppUpdateBanner enabled check={async () => true} />, { route: "/orders" });
    await advance(APP_UPDATE_POLL_MS);

    expect(slot.querySelector("[data-update-banner]")).not.toBeNull();
    expect(slot.querySelector("[data-update-banner]")).not.toHaveClass("sticky");
  });

  it("is sticky on its own without a shell slot (/login, scanner)", async () => {
    renderWithProviders(<AppUpdateBanner enabled check={async () => true} />, { route: "/login" });
    await advance(APP_UPDATE_POLL_MS);
    expect(banner()).toHaveClass("sticky", "top-0");
  });

  it("waits while the session banner is shown (one banner at a time) and comes back on /login", async () => {
    tokenStorage.setSessionMetadata({ refreshTokenWarnAt: NOW + APP_UPDATE_POLL_MS * 2, refreshTokenExpiresAt: NOW + APP_UPDATE_POLL_MS * 4 });
    renderWithProviders(<AppUpdateBanner enabled check={async () => true} />, { route: "/orders" });

    await advance(APP_UPDATE_POLL_MS);
    expect(banner()).not.toBeNull();

    // Sessiya ogohlantirishi boshlandi — sessiya banneri muhimroq.
    await advance(APP_UPDATE_POLL_MS);
    expect(banner()).toBeNull();

    // Qayta kirildi: yangi sessiya — banner qaytadi.
    act(() => {
      tokenStorage.setSessionMetadata({ refreshTokenWarnAt: Date.now() + 86_400_000, refreshTokenExpiresAt: Date.now() + 90_000_000 });
    });
    expect(banner()).not.toBeNull();
  });

  it("is translated (ru, en)", async () => {
    renderWithProviders(<AppUpdateBanner enabled check={async () => true} />, { route: "/orders" });
    await advance(APP_UPDATE_POLL_MS);

    await act(async () => {
      await i18n.changeLanguage("ru");
    });
    expect(screen.getByRole("button", { name: "Обновить" })).toBeInTheDocument();

    await act(async () => {
      await i18n.changeLanguage("en");
    });
    expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument();
  });
});
