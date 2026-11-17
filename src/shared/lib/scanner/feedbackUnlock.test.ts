import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SCANNER_KEY_GAP_MS, useKeyboardScanner } from "../useKeyboardScanner";

/**
 * OVOZ QULFI va BIRINCHI USB SKAN (kYa7c3sh). `new AudioContext()` bosh oqimni 100–300 ms band qiladi — u skanning
 * birinchi belgisida yaratilsa, keyingi belgi skaner oralig'idan kechikib keladi va skanning boshi tushib qoladi
 * («tok-10235» → «ok-10235»). Soxta kontekst konstruktori shu band bo'lishni taqlid qiladi: soatni `BLOCK_MS` ga
 * suradi (hodisa vaqti — `event.timeStamp`, jsdom'da `Date.now()`).
 *
 * Modul har testda yangidan yuklanadi (kontekst, qulf tinglovchilari — modul holati); o'sha nusxaning `window`
 * tinglovchilari yozib olinadi va test oxirida olib tashlanadi — oldingi testlarning nusxalari aralashmaydi.
 */

const BLOCK_MS = 150;
const UNLOCK_EVENTS = ["pointerdown", "touchstart", "keydown"];

const calls = { created: 0, resumed: 0, decoded: 0 };
let initialState: AudioContextState = "suspended";
let resumeResult: () => Promise<void> = () => Promise.resolve();

class FakeAudioContext {
  state: AudioContextState = initialState;
  currentTime = 0;
  destination = {};
  constructor() {
    calls.created += 1;
    // Bosh oqim band: shu orada kelgan tugmalar keyinroq ishlanadi.
    vi.setSystemTime(Date.now() + BLOCK_MS);
  }
  createDynamicsCompressor() {
    const param = { value: 0 };
    return { threshold: param, knee: param, ratio: param, attack: param, release: param, connect: () => undefined };
  }
  createGain() {
    return {
      gain: { value: 0, setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
      connect: () => undefined,
    };
  }
  createOscillator() {
    return {
      type: "sine",
      frequency: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
      connect: () => undefined,
      start: () => undefined,
      stop: () => undefined,
      addEventListener: () => undefined,
    };
  }
  createBufferSource() {
    return { buffer: null, connect: () => undefined, start: () => undefined, stop: () => undefined, addEventListener: () => undefined };
  }
  decodeAudioData(_data: ArrayBuffer, ok?: (buffer: unknown) => void) {
    calls.decoded += 1;
    const buffer = { duration: 1.2 };
    ok?.(buffer);
    return Promise.resolve(buffer);
  }
  resume() {
    calls.resumed += 1;
    return resumeResult().then(() => {
      this.state = "running";
    });
  }
}

const fetchMock = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));
const realFetch = globalThis.fetch;
/** `requestIdleCallback` navbati — test o'zi «bo'sh payt» ni boshlaydi. */
const idleTasks: Array<() => void> = [];
let moduleListeners: Array<[string, EventListenerOrEventListenerObject]> = [];

const load = async () => {
  vi.resetModules();
  const spy = vi.spyOn(window, "addEventListener");
  const feedback = await import("./feedback");
  moduleListeners = spy.mock.calls
    .filter(([type]) => UNLOCK_EVENTS.includes(type))
    .map(([type, listener]) => [type, listener] as [string, EventListenerOrEventListenerObject]);
  spy.mockRestore();
  return feedback;
};

const press = (key: string) => window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
const tap = (type: "pointerdown" | "touchstart") => window.dispatchEvent(new Event(type));

/** USB skaner: belgilar `gapMs` oraliq bilan, so'ng Enter. */
const usbScan = (value: string, gapMs = 10) => {
  for (const char of value) {
    press(char);
    vi.advanceTimersByTime(gapMs);
  }
  press("Enter");
};

const runIdle = () => idleTasks.splice(0).forEach((task) => task());
/** Promise zanjirlari (resume → keyingi qadam) tugashi uchun — soxta taymerlarsiz mikrotasklar. */
const flush = async () => {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  calls.created = 0;
  calls.resumed = 0;
  calls.decoded = 0;
  initialState = "suspended";
  resumeResult = () => Promise.resolve();
  idleTasks.length = 0;
  fetchMock.mockClear();
  window.localStorage.clear();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  Object.defineProperty(window, "AudioContext", { configurable: true, writable: true, value: FakeAudioContext });
  Object.defineProperty(window, "requestIdleCallback", {
    configurable: true,
    writable: true,
    value: vi.fn((task: () => void) => idleTasks.push(task)),
  });
});

afterEach(() => {
  moduleListeners.forEach(([type, listener]) => window.removeEventListener(type, listener));
  moduleListeners = [];
  globalThis.fetch = realFetch;
  Reflect.deleteProperty(window, "AudioContext");
  Reflect.deleteProperty(window, "requestIdleCallback");
  window.localStorage.clear();
  vi.useRealTimers();
});

describe("kYa7c3sh — ovoz qulfi birinchi USB skanni buzmaydi", () => {
  it("sahifa ochilgach birinchi USB skan to'liq o'qiladi: kontekst skan oqimida yaratilmaydi", async () => {
    await load();
    const scans: string[] = [];
    renderHook(() => useKeyboardScanner({ onScan: (value) => void scans.push(value) }));

    usbScan("tok-10235");

    expect(scans).toEqual(["tok-10235"]);
    expect(calls.created).toBe(0);
    // Band bo'lish (soxta konstruktor) skaner oralig'idan katta — shart to'g'ri sinalyapti.
    expect(BLOCK_MS).toBeGreaterThan(SCANNER_KEY_GAP_MS);
  });

  it("klaviatura: kontekst tugmalar to'xtagach yaratiladi va `resume()` o'sha zahoti; dekodlash — bo'sh paytda", async () => {
    const feedback = await load();
    feedback.preloadScanFeedbackAudio();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(10));
    await flush();
    const scans: string[] = [];
    renderHook(() => useKeyboardScanner({ onScan: (value) => void scans.push(value) }));

    usbScan("MCR-201-e2e-0001");
    // Skan davomida va Enter'dan keyin jimlik tugaguncha — na kontekst, na dekodlash.
    vi.advanceTimersByTime(feedback.SCAN_AUDIO_KEY_UNLOCK_QUIET_MS - 1);
    expect(scans).toEqual(["MCR-201-e2e-0001"]);
    expect(calls).toEqual({ created: 0, resumed: 0, decoded: 0 });

    // Jimlik tugadi: kontekst yaratiladi va `resume()` shu taymerning o'zida (taymer tugma ishlovchisida qo'yilgan).
    vi.advanceTimersByTime(1);
    expect(calls).toEqual({ created: 1, resumed: 1, decoded: 0 });

    // Qulf ochildi — dekodlash bo'sh paytga qo'yildi, hali boshlanmadi.
    await flush();
    expect(calls.decoded).toBe(0);
    expect(idleTasks.length).toBeGreaterThan(0);
    runIdle();
    await flush();
    expect(calls.decoded).toBe(10);

    // Qulf ochiq — keyingi skanlarda tinglovchi yo'q (qayta `resume()` yo'q).
    usbScan("tok-10235");
    vi.advanceTimersByTime(feedback.SCAN_AUDIO_KEY_UNLOCK_QUIET_MS);
    expect(scans).toEqual(["MCR-201-e2e-0001", "tok-10235"]);
    expect(calls.resumed).toBe(1);
  });

  it("odam sekin yozsa ham kontekst har tugmada qayta kutiladi — oxirgi tugmadan keyin bitta yaratiladi", async () => {
    const feedback = await load();
    for (const char of "abc") {
      press(char);
      vi.advanceTimersByTime(feedback.SCAN_AUDIO_KEY_UNLOCK_QUIET_MS - 50);
    }
    expect(calls.created).toBe(0);
    vi.advanceTimersByTime(50);
    expect(calls.created).toBe(1);
  });

  it("bosish / teginish (iOS/Safari): kontekst va `resume()` ishlovchining o'zida, dekodlash — bo'sh paytda", async () => {
    const feedback = await load();
    feedback.preloadScanFeedbackAudio();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(10));
    await flush();

    tap("touchstart");
    // Sinxron — harakat ishlovchisi ichida, hech qanday taymer yoki kutishsiz.
    expect(calls).toEqual({ created: 1, resumed: 1, decoded: 0 });

    await flush();
    expect(calls.decoded).toBe(0);
    runIdle();
    await flush();
    expect(calls.decoded).toBe(10);
  });

  it("kontekst skan natijasidan bor (qulf hali yopiq) — keyingi tugmada `resume()` darhol, taymersiz", async () => {
    // Safari: harakatsiz `resume()` rad etiladi — kontekst «suspended» qoladi.
    resumeResult = () => Promise.reject(new Error("NotAllowedError"));
    const feedback = await load();
    feedback.playScanSignal("success");
    expect(calls).toMatchObject({ created: 1, resumed: 1 });
    await flush();

    resumeResult = () => Promise.resolve();
    press("t");
    expect(calls).toMatchObject({ created: 1, resumed: 2 });
  });

  it("brauzer qulfni rad etsa — keyingi harakatda yana urinadi (tinglovchilar qoladi)", async () => {
    resumeResult = () => Promise.reject(new Error("NotAllowedError"));
    await load();
    tap("pointerdown");
    expect(calls).toMatchObject({ created: 1, resumed: 1 });
    await flush();

    resumeResult = () => Promise.resolve();
    tap("pointerdown");
    expect(calls).toMatchObject({ created: 1, resumed: 2 });
    await flush();
    tap("pointerdown");
    expect(calls.resumed).toBe(2);
  });
});
