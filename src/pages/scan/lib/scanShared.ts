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

const SCAN_ERROR_REPEAT_COUNT = 3;
const SCAN_ERROR_REPEAT_DELAY_MS = 170;

export const normalizeScannerValue = (value: string) => {
  return normalizeScannerCandidates(value);
};

export const playMissingOrderFeedback = () => {
  Array.from({ length: SCAN_ERROR_REPEAT_COUNT }).forEach((_, index) => {
    window.setTimeout(() => {
      void playScanFeedback("error");
    }, index * SCAN_ERROR_REPEAT_DELAY_MS);
  });
};

let audioContext: AudioContext | null = null;
let audioUnlocked = false;

const getAudioContext = () => {
  if (typeof window === "undefined") return null;
  const AudioContextCtor = window.AudioContext || (window as typeof window & {
    webkitAudioContext?: typeof AudioContext;
  }).webkitAudioContext;

  if (!AudioContextCtor) return null;
  if (!audioContext) {
    audioContext = new AudioContextCtor();
  }
  return audioContext;
};

const unlockAudio = async () => {
  const context = getAudioContext();
  if (!context || audioUnlocked) return;

  try {
    if (context.state === "suspended") {
      await context.resume();
    }
    audioUnlocked = context.state === "running";
  } catch {
    // ignore unlock failures
  }
};

if (typeof window !== "undefined") {
  const unlockOnce = () => {
    void unlockAudio();
    window.removeEventListener("pointerdown", unlockOnce);
    window.removeEventListener("keydown", unlockOnce);
    window.removeEventListener("touchstart", unlockOnce);
  };

  window.addEventListener("pointerdown", unlockOnce, { once: true });
  window.addEventListener("keydown", unlockOnce, { once: true });
  window.addEventListener("touchstart", unlockOnce, { once: true });
}

export const playScanFeedback = async (type: "success" | "error") => {
  const context = getAudioContext();
  if (!context) return;

  try {
    if (context.state === "suspended") {
      await context.resume();
    }

    const now = context.currentTime;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-18, now);
    compressor.knee.setValueAtTime(8, now);
    compressor.ratio.setValueAtTime(10, now);
    compressor.attack.setValueAtTime(0.003, now);
    compressor.release.setValueAtTime(0.16, now);

    const gain = context.createGain();
    gain.connect(compressor);
    compressor.connect(context.destination);
    gain.gain.setValueAtTime(0.0001, now);

    const playTone = (
      frequency: number,
      start: number,
      duration: number,
      volume: number,
      oscillatorType: OscillatorType,
    ) => {
      const oscillator = context.createOscillator();
      oscillator.type = oscillatorType;
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.connect(gain);
      oscillator.start(start);
      oscillator.stop(start + duration);
      gain.gain.cancelScheduledValues(start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    };

    if (type === "success") {
      playTone(1480, now, 0.11, 0.17, "square");
      playTone(1720, now + 0.055, 0.085, 0.12, "triangle");
      window.navigator.vibrate?.(45);
    } else {
      playTone(420, now, 0.12, 0.14, "square");
      playTone(320, now + 0.14, 0.12, 0.13, "square");
      window.navigator.vibrate?.([55, 40, 55]);
    }
  } catch {
    // ignore feedback failures
  }
};
