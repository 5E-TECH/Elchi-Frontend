import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchScannerSoundPrefs, tgScanHttp } from "../api/tgScanApi";
import { useTgScanSound } from "./scanSound";
import type { ScanFeedback } from "./useScanAssign";

/**
 * JX0EBpa7: Mini App skanida ham asosiy ilovadagi ovoz — hisobdagi tanlov va «Ovoz» kaliti qurilma ko'zgusiga
 * yoziladi, natija → ovoz turi kuryer «O'zimga olish» dagidek, tebranish faqat Telegram'da (ikki marta emas).
 */

const playScanSignal = vi.hoisted(() => vi.fn());
vi.mock("../../../shared/lib/scanner/feedback", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../shared/lib/scanner/feedback")>()),
  playScanSignal,
}));

const profile = (scanner: unknown) => ({
  data: { statusCode: 200, data: { id: "26", settings: { scanner } } },
});

beforeEach(() => {
  window.localStorage.clear();
  playScanSignal.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("fetchScannerSoundPrefs — GET auth/my-profile (Mini App tokeni bilan)", () => {
  it("hisobdagi ovozlar va «Ovoz» kaliti; Telegram tokeni va manba sarlavhasi bilan", async () => {
    const get = vi
      .spyOn(tgScanHttp, "get")
      .mockResolvedValue(
        profile({ sounds: { success: "marimba", error: "glass" }, feedback: { sound: false } }),
      );

    await expect(fetchScannerSoundPrefs("tg.jwt")).resolves.toEqual({
      success: "marimba",
      error: "glass",
      sound: false,
    });
    expect(get).toHaveBeenCalledWith("auth/my-profile", {
      headers: { Authorization: "Bearer tg.jwt", "X-Request-Source": "tg-scan" },
    });
  });

  it("noma'lum ID va yo'q maydonlar — null (qurilmadagi qiymat qoladi)", async () => {
    vi.spyOn(tgScanHttp, "get").mockResolvedValue(profile({ sounds: { success: "eski-ovoz" } }));
    await expect(fetchScannerSoundPrefs("tg.jwt")).resolves.toEqual({
      success: null,
      error: null,
      sound: null,
    });
  });
});

describe("useTgScanSound", () => {
  it("hisob sozlamasi qurilma ko'zgusiga yoziladi (keyingi skan shu ovozni chaladi)", async () => {
    vi.spyOn(tgScanHttp, "get").mockResolvedValue(
      profile({
        sounds: { success: "chime", error: "drop" },
        feedback: { sound: false, vibration: true },
      }),
    );
    renderHook(() => useTgScanSound("tg.jwt"));

    await waitFor(() => expect(window.localStorage.getItem("scanner-success-sound")).toBe("chime"));
    expect(window.localStorage.getItem("scanner-error-sound")).toBe("drop");
    expect(window.localStorage.getItem("scanner-sound-enabled")).toBe("false");
  });

  it("so'rov o'tmasa (401/tarmoq) — jim, qurilmadagi qiymatlar tegilmaydi", async () => {
    window.localStorage.setItem("scanner-success-sound", "bell");
    const get = vi.spyOn(tgScanHttp, "get").mockRejectedValue(new Error("401"));
    renderHook(() => useTgScanSound("tg.jwt"));

    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(window.localStorage.getItem("scanner-success-sound")).toBe("bell");
    expect(window.localStorage.getItem("scanner-sound-enabled")).toBeNull();
  });

  it("natija → ovoz turi (asosiy ilovadagidek), tebranishsiz — Telegram o'zi tebratadi", () => {
    vi.spyOn(tgScanHttp, "get").mockResolvedValue(profile({}));
    const { result } = renderHook(() => useTgScanSound("tg.jwt"));
    const entry = { token: "t" } as never;

    const cases: [ScanFeedback, string][] = [
      [{ key: 1, kind: "assigned", entry }, "success"],
      [{ key: 2, kind: "already", entry }, "duplicate"],
      [{ key: 3, kind: "repeat", entry }, "duplicate"],
      [{ key: 4, kind: "failed", entry }, "error"],
      [{ key: 5, kind: "invalid" }, "error"],
    ];
    for (const [feedback, type] of cases) {
      result.current(feedback);
      expect(playScanSignal).toHaveBeenLastCalledWith(type, { vibrate: false });
    }
    expect(playScanSignal).toHaveBeenCalledTimes(5);
  });
});
