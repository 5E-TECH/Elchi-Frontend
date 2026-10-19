import { afterEach, describe, expect, it, vi } from "vitest";
import {
  playMissingOrderFeedback,
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

  it("playMissingOrderFeedback — `missing` hodisasi", () => {
    const { details, stop } = listen();
    playMissingOrderFeedback();
    stop();
    expect(details).toEqual([{ type: "missing", message: undefined, source: undefined }]);
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
