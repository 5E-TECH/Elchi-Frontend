import {
  readStoredScannerErrorSound,
  readStoredScannerFeedbackPrefs,
  readStoredScannerSuccessSound,
  STORED_SCANNER_SOUNDS,
  type StoredScannerSound,
} from "../preferencesStorage";

/**
 * SKAN NATIJASI SIGNALI — ovoz (WebAudio), tebranish va `SCAN_FEEDBACK_EVENT` hodisasi
 * (taxta `tizim-scanner` §07: success · duplicate · missing · error).
 *
 * Avval `pages/scan/lib/scanShared.ts` da edi; shared va boshqa sahifalar ham ishlatgani uchun shu yerga
 * ko'chirildi (FSD: shared → pages importi bo'lmasin). Hodisa tafsiloti `{ type, message?, source? }` —
 * kamera (`ScannerCamera`) natija qatorini shundan oladi, global `ScanFeedbackOverlay` ham shuni tinglaydi.
 */

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

/** Skan qayerdan keldi: kamera, USB/Bluetooth skaner (klaviatura) yoki qo'lda kiritish. */
export type ScanSource = "camera" | "keyboard" | "manual";

export type ScanFeedbackDetail = {
  type: ScanFeedbackType;
  message?: string;
  source?: ScanSource;
  /** Xabar ostidagi izoh qatori (kamera xabari): «№10251 · Sherzod Nazarov. Menejerga xabar bering.» */
  text?: string;
  /**
   * Oraliq qadam (masalan bekorlarni topshirishda market QR'i qabul qilindi): «Uzluksiz skanerlash» o'chiq
   * bo'lsa ham kamera bunda yopilmaydi — keyingi qadam (buyurtmalar) shu kamerada davom etadi.
   */
  step?: boolean;
};

export const SCAN_FEEDBACK_EVENT = "elchi:scan-feedback";

export type Tone = {
  frequency: number;
  start: number;
  duration: number;
  volume: number;
  oscillator: OscillatorType;
  endFrequency?: number;
  /** Chertilgan tovush: tez ko'tarilib, oxirigacha so'nadi (ushlab turilmaydi) — yumshoq to'plamlar. */
  pluck?: boolean;
};

export const SCANNER_SOUND_IDS: ScannerSoundId[] = [...STORED_SCANNER_SOUNDS];

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
  // JX0EBpa7 — yumshoq to'plamlar: ≤ 250 ms, past ovoz, faqat sine/triangle.
  chime: [
    { frequency: 659.25, start: 0, duration: 0.16, volume: 0.13, oscillator: "sine", pluck: true },
    { frequency: 987.77, start: 0.07, duration: 0.18, volume: 0.11, oscillator: "sine", pluck: true },
    { frequency: 1975.5, start: 0.07, duration: 0.12, volume: 0.025, oscillator: "sine", pluck: true },
  ],
  drop: [
    { frequency: 520, endFrequency: 1040, start: 0, duration: 0.09, volume: 0.14, oscillator: "sine", pluck: true },
    { frequency: 780, endFrequency: 1560, start: 0.1, duration: 0.12, volume: 0.11, oscillator: "sine", pluck: true },
  ],
  marimba: [
    { frequency: 523.25, start: 0, duration: 0.12, volume: 0.15, oscillator: "triangle", pluck: true },
    { frequency: 783.99, start: 0.09, duration: 0.15, volume: 0.13, oscillator: "triangle", pluck: true },
  ],
  bubble: [
    { frequency: 300, endFrequency: 900, start: 0, duration: 0.07, volume: 0.13, oscillator: "sine", pluck: true },
    { frequency: 450, endFrequency: 1350, start: 0.09, duration: 0.08, volume: 0.11, oscillator: "sine", pluck: true },
  ],
  glass: [
    { frequency: 1318.5, start: 0, duration: 0.18, volume: 0.08, oscillator: "sine", pluck: true },
    { frequency: 2637, start: 0, duration: 0.12, volume: 0.02, oscillator: "sine", pluck: true },
    { frequency: 1760, start: 0.08, duration: 0.17, volume: 0.07, oscillator: "sine", pluck: true },
  ],
  breeze: [
    { frequency: 392, endFrequency: 440, start: 0, duration: 0.14, volume: 0.12, oscillator: "sine" },
    { frequency: 523.25, endFrequency: 587.33, start: 0.08, duration: 0.16, volume: 0.1, oscillator: "sine" },
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
  // JX0EBpa7 — yumshoq xato: pastga tushuvchi ikki nota, keskin (square/sawtooth) to'lqinsiz.
  chime: [
    { frequency: 587.33, start: 0, duration: 0.14, volume: 0.13, oscillator: "sine", pluck: true },
    { frequency: 440, start: 0.09, duration: 0.16, volume: 0.13, oscillator: "sine", pluck: true },
  ],
  drop: [
    { frequency: 600, endFrequency: 300, start: 0, duration: 0.11, volume: 0.14, oscillator: "sine", pluck: true },
    { frequency: 450, endFrequency: 225, start: 0.12, duration: 0.12, volume: 0.13, oscillator: "sine", pluck: true },
  ],
  marimba: [
    { frequency: 392, start: 0, duration: 0.12, volume: 0.15, oscillator: "triangle", pluck: true },
    { frequency: 311.13, start: 0.1, duration: 0.15, volume: 0.15, oscillator: "triangle", pluck: true },
  ],
  bubble: [
    { frequency: 500, endFrequency: 250, start: 0, duration: 0.08, volume: 0.13, oscillator: "sine", pluck: true },
    { frequency: 380, endFrequency: 190, start: 0.11, duration: 0.1, volume: 0.13, oscillator: "sine", pluck: true },
  ],
  glass: [
    { frequency: 987.77, start: 0, duration: 0.14, volume: 0.09, oscillator: "sine", pluck: true },
    { frequency: 739.99, start: 0.1, duration: 0.15, volume: 0.09, oscillator: "sine", pluck: true },
  ],
  breeze: [
    { frequency: 349.23, endFrequency: 329.63, start: 0, duration: 0.12, volume: 0.12, oscillator: "sine" },
    { frequency: 293.66, endFrequency: 261.63, start: 0.1, duration: 0.14, volume: 0.12, oscillator: "sine" },
  ],
};

/**
 * «Takror» (allaqachon o'qilgan / qayta skan) — yumshoq to'plamlarda o'z ohangi: bir xil nota ikki marta, qisqa.
 * Eski 6 ta ovozda avvalgidek muvaffaqiyat ohangi chalinadi.
 */
const DUPLICATE_TONES: Partial<Record<ScannerSoundId, Tone[]>> = {
  chime: [
    { frequency: 880, start: 0, duration: 0.07, volume: 0.09, oscillator: "sine", pluck: true },
    { frequency: 880, start: 0.1, duration: 0.09, volume: 0.09, oscillator: "sine", pluck: true },
  ],
  drop: [
    { frequency: 700, endFrequency: 1100, start: 0, duration: 0.08, volume: 0.1, oscillator: "sine", pluck: true },
    { frequency: 700, endFrequency: 1100, start: 0.11, duration: 0.08, volume: 0.1, oscillator: "sine", pluck: true },
  ],
  marimba: [
    { frequency: 659.25, start: 0, duration: 0.08, volume: 0.11, oscillator: "triangle", pluck: true },
    { frequency: 659.25, start: 0.1, duration: 0.1, volume: 0.11, oscillator: "triangle", pluck: true },
  ],
  bubble: [
    { frequency: 400, endFrequency: 1000, start: 0, duration: 0.06, volume: 0.1, oscillator: "sine", pluck: true },
    { frequency: 400, endFrequency: 1000, start: 0.09, duration: 0.06, volume: 0.1, oscillator: "sine", pluck: true },
  ],
  glass: [
    { frequency: 1318.5, start: 0, duration: 0.07, volume: 0.07, oscillator: "sine", pluck: true },
    { frequency: 1318.5, start: 0.1, duration: 0.08, volume: 0.07, oscillator: "sine", pluck: true },
  ],
  breeze: [
    { frequency: 440, start: 0, duration: 0.07, volume: 0.09, oscillator: "sine" },
    { frequency: 440, start: 0.1, duration: 0.08, volume: 0.09, oscillator: "sine" },
  ],
};

const MISSING_TONES: Tone[] = [
  { frequency: 740, endFrequency: 680, start: 0, duration: 0.07, volume: 0.18, oscillator: "sine" },
  { frequency: 740, endFrequency: 680, start: 0.105, duration: 0.07, volume: 0.18, oscillator: "sine" },
  { frequency: 520, endFrequency: 440, start: 0.21, duration: 0.11, volume: 0.19, oscillator: "sine" },
];

/** Natija turi uchun ohanglar — tanlangan (saqlangan) ovozdan; saqlanmagan yoki noma'lum bo'lsa `classic`. */
export const getScanFeedbackTones = (type: ScanFeedbackType): Tone[] => {
  if (type === "success") return SUCCESS_TONES[readStoredScannerSuccessSound() ?? "classic"];
  if (type === "duplicate") {
    const sound = readStoredScannerSuccessSound() ?? "classic";
    return DUPLICATE_TONES[sound] ?? SUCCESS_TONES[sound];
  }
  if (type === "error") return ERROR_TONES[readStoredScannerErrorSound() ?? "classic"];
  return MISSING_TONES;
};

const FEEDBACK_VIBRATION: Record<ScanFeedbackType, number | number[]> = {
  success: 40,
  // Maket `common-settings-scanner`: «xato — uch marta».
  error: [60, 45, 60, 45, 80],
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

  getScanFeedbackTones(type).forEach((tone) => {
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
    if (!tone.pluck) toneGain.gain.setValueAtTime(volume, Math.max(start + 0.005, end - 0.025));
    toneGain.gain.exponentialRampToValueAtTime(0.0001, end);

    activeOscillators.add(oscillator);
    oscillator.addEventListener("ended", () => activeOscillators.delete(oscillator), { once: true });
    oscillator.start(start);
    oscillator.stop(end);
  });
};

export type ScanSignalOptions = {
  /**
   * Sozlamalardagi «Ovoz» / «Tebranish» kalitlariga qaramay chalinsin — faqat «Eshitib ko'rish» (Sozlamalar):
   * foydalanuvchi ohangni aniq so'ragan.
   */
  preview?: boolean;
  /**
   * `false` — faqat ovoz: tebranishni chaqiruvchi o'zi beradi (Telegram Mini App — `HapticFeedback`), aks holda
   * ikki marta tebranardi.
   */
  vibrate?: boolean;
};

/** `playScanFeedback` qo'shimchalari: izoh qatori, oraliq qadam, ovozsiz yangilash. */
export type ScanFeedbackOptions = ScanSignalOptions & {
  text?: string;
  step?: boolean;
  /**
   * Ovoz va tebranishsiz — faqat ekrandagi xabar yangilanadi (masalan rad etilgan buyurtma raqami keyinroq
   * aniqlandi: o'sha natija ikkinchi marta jiringlamasin).
   */
  silent?: boolean;
};

/**
 * Faqat ovoz va tebranish (hodisasiz) — natija ekranda boshqa yo'l bilan ko'rsatilganda
 * (masalan kamera «ruxsat berilmagan» kartasi: xabar qatori kerak emas, xato ovozi kerak).
 * Sozlamalar → Skaner: «Ovoz» o'chiq — ohang yo'q, «Tebranish» o'chiq — tebranish yo'q.
 */
export const playScanSignal = (type: ScanFeedbackType, options: ScanSignalOptions = {}) => {
  const prefs = readStoredScannerFeedbackPrefs();
  if (typeof window !== "undefined" && options.vibrate !== false && (prefs.vibration || options.preview)) {
    window.navigator.vibrate?.(FEEDBACK_VIBRATION[type]);
  }
  if (!prefs.sound && !options.preview) return;

  const context = getAudioContext();
  if (!context) return;

  if (context.state === "running") {
    scheduleFeedback(context, type);
    return;
  }

  void context.resume().then(() => scheduleFeedback(context, type)).catch(() => undefined);
};

/** Natija: `SCAN_FEEDBACK_EVENT` hodisasi (ekrandagi xabar) + ovoz va tebranish. */
export const playScanFeedback = (
  type: ScanFeedbackType,
  message?: string,
  source?: ScanSource,
  options: ScanFeedbackOptions = {},
) => {
  const { text, step, silent, ...signal } = options;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<ScanFeedbackDetail>(SCAN_FEEDBACK_EVENT, {
        detail: { type, message, source, ...(text ? { text } : {}), ...(step ? { step } : {}) },
      }),
    );
  }

  if (!silent) playScanSignal(type, signal);
};
