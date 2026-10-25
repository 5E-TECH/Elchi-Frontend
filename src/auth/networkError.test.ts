import { vi } from "vitest";
import {
  emitNetworkError,
  emitNetworkRestored,
  getNetworkDownKind,
  markNetworkDown,
  NETWORK_ERROR_EVENT,
  NETWORK_RESTORED_EVENT,
} from "./networkError";

/** Haqiqiy axios xatosi shakli (`axios.isAxiosError` — `isAxiosError: true`). */
const axiosError = (code: string, message: string, response?: { status: number }) => ({
  isAxiosError: true,
  code,
  message,
  config: { url: "/orders" },
  ...(response ? { response } : {}),
});

describe("networkError — tarmoq holati (G6F68ti6)", () => {
  const errors = vi.fn();
  const restored = vi.fn();
  const onError = (event: Event) => errors((event as CustomEvent).detail);
  const onRestored = (event: Event) => restored((event as CustomEvent).detail);

  beforeEach(() => {
    emitNetworkRestored(); // oldingi testdan qolgan holat
    errors.mockClear();
    restored.mockClear();
    window.addEventListener(NETWORK_ERROR_EVENT, onError);
    window.addEventListener(NETWORK_RESTORED_EVENT, onRestored);
  });

  afterEach(() => {
    window.removeEventListener(NETWORK_ERROR_EVENT, onError);
    window.removeEventListener(NETWORK_RESTORED_EVENT, onRestored);
  });

  it("javobsiz axios xatosi — «offline», vaqt tugashi — «timeout»", () => {
    emitNetworkError(axiosError("ERR_NETWORK", "Network Error"));
    expect(errors).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "offline", code: "ERR_NETWORK" }));
    emitNetworkRestored();

    emitNetworkError(axiosError("ECONNABORTED", "So'rov vaqti tugadi"));
    expect(errors).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "timeout" }));
    emitNetworkError(axiosError("ETIMEDOUT", "timeout of 20000ms exceeded"));
    expect(errors).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "timeout" }));
  });

  it("13-band: oddiy Error (masalan «Refresh token expired») tarmoq xabarini chaqirmaydi", () => {
    emitNetworkError(new Error("Refresh token expired"));
    expect(errors).not.toHaveBeenCalled();
    expect(getNetworkDownKind()).toBeNull();
  });

  it("12-band: brauzer bekor qilgan so'rov («Request aborted») va ERR_CANCELED — xabarsiz", () => {
    emitNetworkError(axiosError("ECONNABORTED", "Request aborted"));
    emitNetworkError(axiosError("ERR_CANCELED", "canceled"));
    expect(errors).not.toHaveBeenCalled();
    expect(getNetworkDownKind()).toBeNull();
  });

  it("javob kelgan xato (500) — tarmoq xatosi emas", () => {
    emitNetworkError(axiosError("ERR_BAD_RESPONSE", "Request failed with status code 500", { status: 500 }));
    expect(errors).not.toHaveBeenCalled();
  });

  it("9-band: fon so'rovi (silent) — xabar yo'q, lekin holat belgilanadi va tiklanish e'lon qilinadi", () => {
    emitNetworkError(axiosError("ERR_NETWORK", "Network Error"), { silent: true });
    expect(errors).not.toHaveBeenCalled();
    expect(getNetworkDownKind()).toBe("offline");

    emitNetworkRestored();
    expect(restored).toHaveBeenCalledWith({ kind: "offline" });
  });

  it("«tiklandi» faqat uzilish→tiklanish o'tishida, bir marta", () => {
    emitNetworkRestored();
    expect(restored).not.toHaveBeenCalled();

    emitNetworkError(axiosError("ERR_NETWORK", "Network Error"));
    emitNetworkRestored();
    emitNetworkRestored();
    expect(restored).toHaveBeenCalledTimes(1);
    expect(getNetworkDownKind()).toBeNull();
  });

  it("oflayn kuchliroq: keyingi vaqt tugashi uni «timeout» ga tushirmaydi, aksi esa almashtiradi", () => {
    markNetworkDown("offline");
    markNetworkDown("timeout");
    expect(getNetworkDownKind()).toBe("offline");
    emitNetworkRestored();

    markNetworkDown("timeout");
    markNetworkDown("offline");
    expect(getNetworkDownKind()).toBe("offline");
  });
});
