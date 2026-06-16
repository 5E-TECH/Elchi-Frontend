import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import { extractScannerToken, normalizeScannerCandidates } from "../../../shared/lib/scanToken";

export { extractScannerToken, normalizeScannerCandidates };

export const getScanOrderQueryKey = (token: string) =>
  ["scan-order", extractScannerToken(token) ?? token.trim()] as const;

export const fetchScanOrder = async (token: string) => {
  const normalizedToken = extractScannerToken(token) ?? token.trim();
  return api
    .get(API_ENDPOINTS.ORDERS.QR_CODE(encodeURIComponent(normalizedToken)))
    .then((res) => res.data);
};

export const normalizeScannerValue = (value: string) => {
  return normalizeScannerCandidates(value);
};

export const playMissingOrderFeedback = () => {
  void playScanFeedback("missing");
};

let audioContext: AudioContext | null = null;
let audioOutput: GainNode | null = null;
const activeOscillators = new Set<OscillatorNode>();

const getAudioContext = () => {
  if (typeof window === "undefined") return null;
  const AudioContextCtor = window.AudioContext || (window as typeof window & {
    webkitAudioContext?: typeof AudioContext;
  }).webkitAudioContext;

  if (!AudioContextCtor) return null;
  if (!audioContext) {
    audioContext = new AudioContextCtor({ latencyHint: "interactive" });

    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 6;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.001;
    compressor.release.value = 0.08;

    audioOutput = audioContext.createGain();
    audioOutput.gain.value = 0.78;
    audioOutput.connect(compressor);
    compressor.connect(audioContext.destination);
  }
  return audioContext;
};

const unlockAudio = async () => {
  const context = getAudioContext();
  if (!context || context.state === "running") return;

  try {
    await context.resume();
  } catch {
    // ignore unlock failures
  }
};

if (typeof window !== "undefined") {
  const removeUnlockListeners = () => {
    window.removeEventListener("pointerdown", unlockOnce);
    window.removeEventListener("keydown", unlockOnce);
    window.removeEventListener("touchstart", unlockOnce);
  };

  const unlockOnce = () => {
    void unlockAudio().then(() => {
      if (audioContext?.state === "running") removeUnlockListeners();
    });
  };

  window.addEventListener("pointerdown", unlockOnce);
  window.addEventListener("keydown", unlockOnce);
  window.addEventListener("touchstart", unlockOnce);
}

export type ScanFeedbackType = "success" | "error" | "missing";

export type ScanFeedbackDetail = {
  type: ScanFeedbackType;
  message?: string;
};

export const SCAN_FEEDBACK_EVENT = "elchi:scan-feedback";

type Tone = {
  frequency: number;
  start: number;
  duration: number;
  volume: number;
  oscillator: OscillatorType;
  endFrequency?: number;
};

const FEEDBACK_TONES: Record<ScanFeedbackType, Tone[]> = {
  success: [
    { frequency: 880, endFrequency: 1046, start: 0, duration: 0.085, volume: 0.19, oscillator: "sine" },
    { frequency: 1318, endFrequency: 1568, start: 0.065, duration: 0.13, volume: 0.21, oscillator: "sine" },
  ],
  error: [
    { frequency: 330, endFrequency: 245, start: 0, duration: 0.11, volume: 0.18, oscillator: "triangle" },
    { frequency: 245, endFrequency: 180, start: 0.09, duration: 0.16, volume: 0.2, oscillator: "triangle" },
  ],
  missing: [
    { frequency: 740, endFrequency: 680, start: 0, duration: 0.07, volume: 0.18, oscillator: "sine" },
    { frequency: 740, endFrequency: 680, start: 0.105, duration: 0.07, volume: 0.18, oscillator: "sine" },
    { frequency: 520, endFrequency: 440, start: 0.21, duration: 0.11, volume: 0.19, oscillator: "sine" },
  ],
};

const FEEDBACK_VIBRATION: Record<ScanFeedbackType, number | number[]> = {
  success: 40,
  error: [60, 45, 80],
  missing: [35, 55, 35, 55, 70],
};

const stopActiveFeedback = () => {
  activeOscillators.forEach((oscillator) => {
    try {
      oscillator.stop();
    } catch {
      // oscillator already stopped
    }
  });
  activeOscillators.clear();
};

const scheduleFeedback = (context: AudioContext, type: ScanFeedbackType) => {
  const output = audioOutput;
  if (!output) return;

  stopActiveFeedback();
  const now = context.currentTime + 0.002;

  FEEDBACK_TONES[type].forEach((tone) => {
    const start = now + tone.start;
    const end = start + tone.duration;
    const oscillator = context.createOscillator();
    const toneGain = context.createGain();

    oscillator.type = tone.oscillator;
    oscillator.frequency.setValueAtTime(tone.frequency, start);
    if (tone.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(tone.endFrequency, end);
    }
    oscillator.connect(toneGain);
    toneGain.connect(output);

    toneGain.gain.setValueAtTime(0.0001, start);
    toneGain.gain.exponentialRampToValueAtTime(tone.volume, start + 0.004);
    toneGain.gain.setValueAtTime(tone.volume, Math.max(start + 0.005, end - 0.025));
    toneGain.gain.exponentialRampToValueAtTime(0.0001, end);

    activeOscillators.add(oscillator);
    oscillator.addEventListener("ended", () => activeOscillators.delete(oscillator), { once: true });
    oscillator.start(start);
    oscillator.stop(end);
  });
};

export const playScanFeedback = (type: ScanFeedbackType, message?: string) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<ScanFeedbackDetail>(SCAN_FEEDBACK_EVENT, {
        detail: { type, message },
      }),
    );
  }

  const context = getAudioContext();
  if (!context) return;

  window.navigator.vibrate?.(FEEDBACK_VIBRATION[type]);

  if (context.state === "running") {
    scheduleFeedback(context, type);
    return;
  }

  void context.resume().then(() => scheduleFeedback(context, type)).catch(() => undefined);
};
