import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getScanFeedbackTones,
  playScanFeedback,
  playScanSignal,
  SCAN_FEEDBACK_EVENT,
  SCANNER_SOUND_IDS,
  type ScanFeedbackDetail,
  type Tone,
} from "./feedback";

const listen = () => {
  const details: ScanFeedbackDetail[] = [];
  const handler = (event: Event) => details.push((event as CustomEvent<ScanFeedbackDetail>).detail);
  window.addEventListener(SCAN_FEEDBACK_EVENT, handler);
  return { details, stop: () => window.removeEventListener(SCAN_FEEDBACK_EVENT, handler) };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("scanner feedback (shared/lib/scanner/feedback)", () => {
  it("hodisa tafsiloti: { type, message, source }", () => {
    const { details, stop } = listen();
    playScanFeedback("success", "Qabul qilindi", "camera");
    playScanFeedback("duplicate");
    stop();
    expect(details).toEqual([
      { type: "success", message: "Qabul qilindi", source: "camera" },
      { type: "duplicate", message: undefined, source: undefined },
    ]);
  });

  it("playScanSignal — faqat ovoz/tebranish, ekrandagi xabar hodisasi yo'q", () => {
    const { details, stop } = listen();
    playScanSignal("error");
    stop();
    expect(details).toEqual([]);
  });

  it("sozlamalardagi ovozlar: eski 6 tasi o'z o'rnida, keyin 6 ta yumshoq (JX0EBpa7)", () => {
    expect(SCANNER_SOUND_IDS).toEqual([
      "classic",
      "soft",
      "digital",
      "bell",
      "pulse",
      "bright",
      "chime",
      "drop",
      "marimba",
      "bubble",
      "glass",
      "breeze",
    ]);
  });
});

describe("JX0EBpa7 — yumshoq ovoz to'plamlari", () => {
  const SOFT = ["chime", "drop", "marimba", "bubble", "glass", "breeze"] as const;
  const length = (tones: Tone[]) => Math.max(...tones.map((tone) => tone.start + tone.duration));
  const pick = (success: string, error = success) => {
    window.localStorage.setItem("scanner-success-sound", success);
    window.localStorage.setItem("scanner-error-sound", error);
  };

  afterEach(() => window.localStorage.clear());

  it.each(SOFT)("%s: muvaffaqiyat, takror va xato — ≤ 250 ms, past ovoz, keskin to'lqinsiz", (sound) => {
    pick(sound);
    for (const type of ["success", "duplicate", "error"] as const) {
      const tones = getScanFeedbackTones(type);
      expect(tones.length).toBeGreaterThan(0);
      expect(length(tones)).toBeLessThanOrEqual(0.25 + 1e-9);
      for (const tone of tones) {
        expect(tone.volume).toBeLessThanOrEqual(0.15);
        expect(["sine", "triangle"]).toContain(tone.oscillator);
      }
    }
  });

  it.each(SOFT)("%s: «takror» o'z ohangi (muvaffaqiyatdan farqli), xato ham boshqa", (sound) => {
    pick(sound);
    expect(getScanFeedbackTones("duplicate")).not.toEqual(getScanFeedbackTones("success"));
    expect(getScanFeedbackTones("error")).not.toEqual(getScanFeedbackTones("success"));
  });

  it("muvaffaqiyat va xato alohida tanlanadi: success — marimba, error — glass", () => {
    pick("marimba");
    const marimbaSuccess = getScanFeedbackTones("success");
    pick("glass");
    const glassError = getScanFeedbackTones("error");

    pick("marimba", "glass");
    expect(getScanFeedbackTones("success")).toEqual(marimbaSuccess);
    expect(getScanFeedbackTones("error")).toEqual(glassError);
    expect(marimbaSuccess).not.toEqual(glassError);
  });

  it("eski ovozlar o'zgarmagan: classic ohangi va «takror» = muvaffaqiyat (avvalgidek)", () => {
    pick("classic");
    expect(getScanFeedbackTones("success")).toEqual([
      { frequency: 784, endFrequency: 880, start: 0, duration: 0.13, volume: 0.22, oscillator: "triangle" },
      { frequency: 1175, endFrequency: 1318, start: 0.105, duration: 0.16, volume: 0.18, oscillator: "sine" },
    ]);
    for (const sound of ["classic", "soft", "digital", "bell", "pulse", "bright"]) {
      pick(sound);
      expect(getScanFeedbackTones("duplicate")).toBe(getScanFeedbackTones("success"));
    }
  });

  it("zaxira: saqlanmagan yoki noma'lum ID — classic", () => {
    const classic = getScanFeedbackTones("success");
    pick("eski-ovoz", "???");
    expect(getScanFeedbackTones("success")).toEqual(classic);
    window.localStorage.clear();
    expect(getScanFeedbackTones("success")).toEqual(classic);
    expect(getScanFeedbackTones("error")[0]).toEqual(
      expect.objectContaining({ frequency: 784, oscillator: "square" }),
    );
  });
});

describe("Sozlamalar → Skaner: «Ovoz» va «Tebranish» kalitlari", () => {
  afterEach(() => {
    window.localStorage.clear();
    Reflect.deleteProperty(navigator, "vibrate");
  });

  const mockVibrate = () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrate });
    return vibrate;
  };

  it("sukut — tebranadi (muvaffaqiyat: bir marta qisqa, xato: uch marta)", () => {
    const vibrate = mockVibrate();
    playScanSignal("success");
    playScanSignal("error");
    expect(vibrate).toHaveBeenNthCalledWith(1, 40);
    expect(vibrate).toHaveBeenNthCalledWith(2, [60, 45, 60, 45, 80]);
  });

  it("«Tebranish» o'chiq — tebranmaydi; «Eshitib ko'rish» (preview) baribir signal beradi", () => {
    window.localStorage.setItem("scanner-vibration", "false");
    const vibrate = mockVibrate();
    playScanSignal("success");
    playScanFeedback("error");
    expect(vibrate).not.toHaveBeenCalled();
    playScanFeedback("success", "Qabul qilindi", undefined, { preview: true });
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it("`vibrate: false` (Mini App — Telegram tebratadi) — tebranish yo'q, «Tebranish» yoqiq bo'lsa ham", () => {
    const vibrate = mockVibrate();
    playScanSignal("success", { vibrate: false });
    playScanSignal("error", { vibrate: false });
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("`silent` — faqat ekrandagi xabar (izoh qatori bilan), ovoz va tebranish yo'q", () => {
    const vibrate = mockVibrate();
    const { details, stop } = listen();
    playScanFeedback("error", "Boshqa kuryerga biriktirilgan", "camera", { text: "№10251", silent: true });
    stop();
    expect(vibrate).not.toHaveBeenCalled();
    expect(details).toEqual([
      expect.objectContaining({ type: "error", message: "Boshqa kuryerga biriktirilgan", text: "№10251" }),
    ]);
  });

  it("«Ovoz» o'chiq — ohang chalinmaydi (AudioContext yaratilmaydi), ekrandagi xabar hodisasi qoladi", () => {
    window.localStorage.setItem("scanner-sound-enabled", "false");
    const ctor = vi.fn();
    Object.defineProperty(window, "AudioContext", { configurable: true, writable: true, value: ctor });
    const { details, stop } = listen();
    playScanFeedback("success", "Qabul qilindi");
    stop();
    expect(ctor).not.toHaveBeenCalled();
    expect(details).toHaveLength(1);
    Reflect.deleteProperty(window, "AudioContext");
  });
});
