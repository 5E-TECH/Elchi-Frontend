import { afterEach, describe, expect, it, vi } from "vitest";
import {
  playScanFeedback,
  playScanSignal,
  SCAN_FEEDBACK_EVENT,
  SCANNER_SOUND_IDS,
  type ScanFeedbackDetail,
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

  it("sozlamalardagi 6 ta ovoz", () => {
    expect(SCANNER_SOUND_IDS).toEqual(["classic", "soft", "digital", "bell", "pulse", "bright"]);
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
    expect(vibrate).toHaveBeenNthCalledWith(2, [60, 45, 80]);
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
