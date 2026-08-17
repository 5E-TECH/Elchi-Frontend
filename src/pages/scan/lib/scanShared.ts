import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import { extractScannerToken, normalizeScannerCandidates } from "../../../shared/lib/scanToken";
import {
  readStoredScannerErrorSound,
  readStoredScannerSuccessSound,
  type StoredScannerSound,
} from "../../../shared/lib/preferencesStorage";

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

export type ScanFeedbackType = "success" | "error" | "missing" | "duplicate";
export type ScannerSoundId = StoredScannerSound;

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

export const SCANNER_SOUND_IDS: ScannerSoundId[] = ["classic", "soft", "digital", "bell", "pulse", "bright"];

const SUCCESS_TONES: Record<ScannerSoundId, Tone[]> = {
  classic: [
    { frequency: 784, endFrequency: 880, start: 0, duration: 0.13, volume: 0.22, oscillator: "triangle" },
    { frequency: 1175, endFrequency: 1318, start: 0.105, duration: 0.16, volume: 0.18, oscillator: "sine" },
  ],
  soft: [
    { frequency: 392, endFrequency: 440, start: 0, duration: 0.28, volume: 0.16, oscillator: "sine" },
    { frequency: 494, endFrequency: 523, start: 0.05, duration: 0.3, volume: 0.12, oscillator: "sine" },
    { frequency: 659, endFrequency: 698, start: 0.1, duration: 0.26, volume: 0.09, oscillator: "triangle" },
  ],
  digital: [
    { frequency: 1175, start: 0, duration: 0.055, volume: 0.16, oscillator: "square" },
    { frequency: 1568, start: 0.075, duration: 0.075, volume: 0.14, oscillator: "square" },
  ],
  bell: [
    { frequency: 1046, start: 0, duration: 0.42, volume: 0.18, oscillator: "sine" },
    { frequency: 2093, start: 0.018, duration: 0.46, volume: 0.08, oscillator: "sine" },
    { frequency: 1568, start: 0.24, duration: 0.28, volume: 0.11, oscillator: "triangle" },
  ],
  pulse: [
    { frequency: 660, start: 0, duration: 0.045, volume: 0.2, oscillator: "triangle" },
    { frequency: 660, start: 0.075, duration: 0.045, volume: 0.2, oscillator: "triangle" },
    { frequency: 990, start: 0.15, duration: 0.045, volume: 0.22, oscillator: "triangle" },
    { frequency: 1320, start: 0.225, duration: 0.075, volume: 0.19, oscillator: "triangle" },
  ],
  bright: [
    { frequency: 1568, endFrequency: 2093, start: 0, duration: 0.085, volume: 0.2, oscillator: "triangle" },
    { frequency: 2349, endFrequency: 3136, start: 0.075, duration: 0.12, volume: 0.15, oscillator: "sine" },
    { frequency: 3520, start: 0.185, duration: 0.055, volume: 0.08, oscillator: "sine" },
  ],
};

const ERROR_TONES: Record<ScannerSoundId, Tone[]> = {
  classic: [
    { frequency: 784, endFrequency: 740, start: 0, duration: 0.07, volume: 0.3, oscillator: "square" },
    { frequency: 370, endFrequency: 349, start: 0.095, duration: 0.09, volume: 0.34, oscillator: "square" },
    { frequency: 262, endFrequency: 247, start: 0.205, duration: 0.12, volume: 0.32, oscillator: "triangle" },
  ],
  soft: [
    { frequency: 440, endFrequency: 415, start: 0, duration: 0.12, volume: 0.23, oscillator: "triangle" },
    { frequency: 440, endFrequency: 415, start: 0.16, duration: 0.12, volume: 0.23, oscillator: "triangle" },
    { frequency: 330, endFrequency: 311, start: 0.31, duration: 0.16, volume: 0.24, oscillator: "sine" },
  ],
  digital: [
    { frequency: 220, start: 0, duration: 0.075, volume: 0.17, oscillator: "square" },
    { frequency: 196, start: 0.095, duration: 0.075, volume: 0.17, oscillator: "square" },
    { frequency: 174, start: 0.19, duration: 0.095, volume: 0.18, oscillator: "square" },
  ],
  bell: [
    { frequency: 330, start: 0, duration: 0.055, volume: 0.3, oscillator: "square" },
    { frequency: 330, start: 0.105, duration: 0.055, volume: 0.3, oscillator: "square" },
    { frequency: 247, start: 0.21, duration: 0.055, volume: 0.32, oscillator: "square" },
    { frequency: 185, start: 0.315, duration: 0.09, volume: 0.34, oscillator: "triangle" },
  ],
  pulse: [
    { frequency: 220, start: 0, duration: 0.05, volume: 0.27, oscillator: "sawtooth" },
    { frequency: 220, start: 0.085, duration: 0.05, volume: 0.27, oscillator: "sawtooth" },
    { frequency: 220, start: 0.17, duration: 0.05, volume: 0.27, oscillator: "sawtooth" },
    { frequency: 165, start: 0.255, duration: 0.12, volume: 0.3, oscillator: "sawtooth" },
  ],
  bright: [
    { frequency: 622, start: 0, duration: 0.07, volume: 0.3, oscillator: "triangle" },
    { frequency: 466, start: 0.085, duration: 0.07, volume: 0.32, oscillator: "triangle" },
    { frequency: 622, start: 0.185, duration: 0.07, volume: 0.3, oscillator: "triangle" },
    { frequency: 311, endFrequency: 294, start: 0.275, duration: 0.11, volume: 0.34, oscillator: "sawtooth" },
  ],
};

const MISSING_TONES: Tone[] = [
  { frequency: 740, endFrequency: 680, start: 0, duration: 0.07, volume: 0.18, oscillator: "sine" },
  { frequency: 740, endFrequency: 680, start: 0.105, duration: 0.07, volume: 0.18, oscillator: "sine" },
  { frequency: 520, endFrequency: 440, start: 0.21, duration: 0.11, volume: 0.19, oscillator: "sine" },
];

const getFeedbackTones = (type: ScanFeedbackType): Tone[] => {
  if (type === "success") return SUCCESS_TONES[readStoredScannerSuccessSound() ?? "classic"];
  if (type === "duplicate") return SUCCESS_TONES[readStoredScannerSuccessSound() ?? "classic"];
  if (type === "error") return ERROR_TONES[readStoredScannerErrorSound() ?? "classic"];
  return MISSING_TONES;
};

const FEEDBACK_VIBRATION: Record<ScanFeedbackType, number | number[]> = {
  success: 40,
  error: [60, 45, 80],
  missing: [35, 55, 35, 55, 70],
  duplicate: [35, 55, 35, 55, 70],
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
  const volumeScale = type === "success" ? 0.7 : 1;

  getFeedbackTones(type).forEach((tone) => {
    const start = now + tone.start;
    const end = start + tone.duration;
    const volume = tone.volume * volumeScale;
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
    toneGain.gain.exponentialRampToValueAtTime(volume, start + 0.004);
    toneGain.gain.setValueAtTime(volume, Math.max(start + 0.005, end - 0.025));
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
