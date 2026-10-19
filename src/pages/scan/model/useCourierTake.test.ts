import { createElement, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n, { i18nReady } from "../../../i18n";
import type { ScanEntry } from "../../../features/tg-scan/model/useScanAssign";
import { isOtherCourierError, summarizeTakeEntries, useCourierTake } from "./useCourierTake";

const assignMock = vi.hoisted(() => vi.fn());

vi.mock("../lib/scanResource", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/scanResource")>()),
  scanAssignOrder: (token: string) => assignMock(token),
  invalidateAfterScanAction: () => Promise.resolve(),
}));

const ok = (token: string, orderId: string, status: "assigned" | "already"): ScanEntry => ({
  key: `${token}-${status}`,
  status,
  token,
  orderId,
  order: null,
  at: 0,
});
const failed = (token: string, message = "Buyurtma paketga joylangan"): ScanEntry => ({
  key: `${token}-failed`,
  status: "failed",
  token,
  error: { kind: "message", message },
  at: 0,
});

describe("kuryer «O'zimga olish» — xulosa", () => {
  it("yangi biriktirilgan, avval ham sizda bo'lgan va biriktirilmagan — noyob sanaladi", () => {
    expect(
      summarizeTakeEntries([
        ok("t1", "10191", "assigned"),
        ok("t1", "10191", "already"),
        ok("t2", "10172", "already"),
        failed("t3"),
        failed("t3"),
        failed("t4"),
        ok("t4", "10180", "assigned"),
      ]),
    ).toEqual({ assigned: 2, already: 1, failed: 1 });
  });

  it("boshqa kuryer — backend matnidan (sabab kodi ochiq emas)", () => {
    expect(isOtherCourierError({ kind: "message", message: "Order allaqachon boshqa courierga biriktirilgan" })).toBe(true);
    expect(isOtherCourierError({ kind: "message", message: "Buyurtma boshqa kuryerda" })).toBe(true);
    expect(isOtherCourierError({ kind: "message", message: "Buyurtma paketga joylangan" })).toBe(false);
    expect(isOtherCourierError({ kind: "offline", message: null })).toBe(false);
  });
});

describe("kuryer «O'zimga olish» — ovoz va tebranish Sozlamalar bo'yicha", () => {
  beforeAll(async () => {
    await i18nReady;
    await i18n.changeLanguage("uz");
  });

  afterEach(() => {
    window.localStorage.clear();
    Reflect.deleteProperty(navigator, "vibrate");
    assignMock.mockReset();
  });

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      I18nextProvider,
      { i18n },
      createElement(QueryClientProvider, { client: new QueryClient() }, children),
    );

  const scanOnce = async (vibrationEnabled: boolean) => {
    window.localStorage.setItem("scanner-vibration", String(vibrationEnabled));
    window.localStorage.setItem("scanner-sound-enabled", "false");
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrate });
    assignMock.mockResolvedValue({
      statusCode: 200,
      data: { idempotent: false, order_id: "10191", post_id: "p-1", post_created: false, order: null },
    });
    const { result } = renderHook(() => useCourierTake({ enabled: true }), { wrapper });
    act(() => result.current.handleScan("a1b2c3d4e5f60718293a4b5c", "camera"));
    await waitFor(() => expect(result.current.summary.assigned).toBe(1));
    return vibrate;
  };

  it("«Tebranish» o'chiq — skan natijasida navigator.vibrate umuman chaqirilmaydi", async () => {
    expect(await scanOnce(false)).not.toHaveBeenCalled();
  });

  it("«Tebranish» yoqiq — bitta natija, bitta tebranish (ikki marta emas)", async () => {
    const vibrate = await scanOnce(true);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(40);
  });
});
