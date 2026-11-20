import { vi } from "vitest";
import {
  classifyNetworkFailure,
  emitNetworkError,
  emitNetworkRestored,
  getNetworkDownKind,
  markNetworkDown,
  NETWORK_ERROR_EVENT,
  NETWORK_RESTORED_EVENT,
} from "./networkError";
import { CONNECTIVITY_PROBE_PATH, resetConnectivityProbe } from "../shared/lib/connectivityProbe";

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

  /** Ilova sayti tekshiruvi (`connectivityProbe.ts`): sukut — sayt ham javob bermaydi (internet yo'q). */
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    emitNetworkRestored(); // oldingi testdan qolgan holat
    resetConnectivityProbe();
    fetchMock.mockReset().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    errors.mockClear();
    restored.mockClear();
    window.addEventListener(NETWORK_ERROR_EVENT, onError);
    window.addEventListener(NETWORK_RESTORED_EVENT, onRestored);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  describe("javobsizlik sababi — ilova sayti tekshiruvi (classifyNetworkFailure, 2026-11-20)", () => {
    const classified = async (error = axiosError("ERR_NETWORK", "Network Error")) => {
      await classifyNetworkFailure(error);
      return error as ReturnType<typeof axiosError> & { networkCause?: string };
    };

    it("ilova sayti ochilmadi — `internet` («Internet aloqasi yo'q»)", async () => {
      const error = await classified();
      expect(fetchMock).toHaveBeenCalledWith(CONNECTIVITY_PROBE_PATH, expect.objectContaining({ method: "HEAD", cache: "no-store" }));
      expect(error.networkCause).toBe("internet");
      emitNetworkError(error);
      expect(errors).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "offline", cause: "internet" }));
    });

    it("ilova sayti javob berdi (hatto 404) — internet bor, API javob bermadi: `server`", async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
      const error = await classified();
      expect(error.networkCause).toBe("server");
      emitNetworkError(error);
      expect(errors).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "offline", cause: "server" }));
      // Holat — «offline»: birinchi javob xabarni yopadi va «Aloqa tiklandi» chiqadi.
      expect(getNetworkDownKind()).toBe("offline");
    });

    it("bir vaqtdagi bir nechta xato — bitta tekshiruv so'rovi", async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
      const all = await Promise.all([classified(), classified(), classified()]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(all.map((e) => e.networkCause)).toEqual(["server", "server", "server"]);
    });

    it("sabab xato bilan yuradi: tekshiruv paytida boshqa so'rov javob olsa ham yiqilgan amal xabari yo'qolmaydi", async () => {
      let answer: (response: Response) => void = () => undefined;
      fetchMock.mockImplementation(() => new Promise<Response>((resolve) => { answer = resolve; }));
      const error = axiosError("ERR_NETWORK", "Network Error");
      const pending = classifyNetworkFailure(error);
      emitNetworkRestored(); // parallel fon so'rovi javob oldi
      answer(new Response(null, { status: 200 }));
      await pending;
      emitNetworkError(error);
      expect(errors).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "offline", cause: "server" }));
    });

    it("sababi aniqlanmagan javobsiz xato — `internet` (avvalgidek)", () => {
      emitNetworkError(axiosError("ERR_NETWORK", "Network Error"));
      expect(errors).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "offline", cause: "internet" }));
    });

    it("brauzer oflayn — tekshiruvsiz `internet`", async () => {
      const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
      try {
        expect((await classified()).networkCause).toBe("internet");
        expect(fetchMock).not.toHaveBeenCalled();
      } finally {
        onLine.mockRestore();
      }
    });

    it("vaqt tugashi, bekor qilish va javobli xato — tekshirilmaydi, sabab yozilmaydi", async () => {
      for (const error of [
        axiosError("ECONNABORTED", "So'rov vaqti tugadi"),
        axiosError("ERR_CANCELED", "canceled"),
        axiosError("ERR_BAD_RESPONSE", "Request failed with status code 502", { status: 502 }),
      ]) {
        expect((await classified(error)).networkCause).toBeUndefined();
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
