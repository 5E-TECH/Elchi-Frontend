import {
  DEFAULT_SCANNER_SOUND,
  readStoredScannerErrorSound,
  readStoredScannerFeedbackPrefs,
  readStoredScannerSuccessSound,
  STORED_SCANNER_SOUNDS,
  type StoredScannerSound,
} from "../preferencesStorage";

/**
 * SKAN NATIJASI SIGNALI — ovoz (WebAudio), «Ovozli xabar», tebranish va `SCAN_FEEDBACK_EVENT` hodisasi
 * (taxta `tizim-scanner` §07: success · duplicate · missing · error).
 *
 * Avval `pages/scan/lib/scanShared.ts` da edi (fayl o'chirilgan); shared va boshqa sahifalar ham ishlatgani uchun shu yerga
 * ko'chirildi (FSD: shared → pages importi bo'lmasin). Hodisa tafsiloti `{ type, message?, source? }` —
 * kamera (`ScannerCamera`) natija qatorini shundan oladi, global `ScanFeedbackOverlay` ham shuni tinglaydi.
 *
 * Ovoz ikki xil: sintez ohanglar (`Tone[]`, osilator) va mp3 fayllar — BeePost skaneri ovozlari (`beepost`, sukut)
 * va o'zbekcha «Ovozli xabar» iboralari (`public/sound`). Fayllar o'sha `AudioContext` da dekodlanib chalinadi:
 * kechikish yo'q, iOS'da ham (kamera skani foydalanuvchi bosishisiz keladi — `HTMLAudioElement` u yerda jim qolardi),
 * va har yangi signal oldingisini (ibora ham) to'xtatadi — tez ketma-ket skanda ovozlar ustma-ust tushmaydi.
 */

let audioContext: AudioContext | null = null;
let audioOutput: GainNode | null = null;
/** mp3 fayllar chiqishi — kompressorsiz (asl ovoz balandligi o'zgarmasin), to'g'ridan-to'g'ri karnayga. */
let fileOutput: GainNode | null = null;
/** Chalinayotgan yoki rejalashtirilgan manbalar (osilator va fayl) — yangi signal ularni to'xtatadi. */
const activeSources = new Set<AudioScheduledSourceNode>();
/** Har signal — yangi avlod: yuklanib kechikkan eski signal (va uning iborasi) chalinmaydi. */
let generation = 0;

type AudioContextConstructor = typeof AudioContext;

const getAudioContextCtor = (): AudioContextConstructor | null => {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext ||
    null
  );
};

const getAudioContext = () => {
  const AudioContextCtor = getAudioContextCtor();
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

    fileOutput = audioContext.createGain();
    fileOutput.gain.value = 1;
    fileOutput.connect(audioContext.destination);
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
      // Oldindan yuklangan (skan sahifasi ochilganda) fayllar endi dekodlanadi — birinchi skan darhol chalinadi.
      if (audioContext) decodeFetchedFiles(audioContext);
      if (audioContext?.state === "running") removeUnlockListeners();
    });
  };

  window.addEventListener("pointerdown", unlockOnce);
  window.addEventListener("keydown", unlockOnce);
  window.addEventListener("touchstart", unlockOnce);
}

export type ScanFeedbackType = "success" | "error" | "missing" | "duplicate";
export type ScannerSoundId = StoredScannerSound;
/** Sintez ohangli ovozlar (fayl emas). */
type ToneSoundId = Exclude<ScannerSoundId, "beepost">;

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

/** `public/` dagi fayl manzili — ilova bazasi bilan (`vite.config` → `base`); Mini App (`/tg/scan`) da ham ildizdan. */
const publicFile = (path: string) => `${import.meta.env.BASE_URL}${path}`;

/** mp3 ovoz: manzil, balandlik (0..1) va eshitiladigan qismi (s) — «Ovozli xabar» shundan keyin boshlanadi. */
export type ScanSoundFile = { url: string; volume: number; audible: number };

/**
 * BeePost skaneri ovozlari (`post_control_system` → `client/public/sound/beep.mp3`, `error.mp3`; balandlik ham
 * BeePost'dagidek — 0,7 va 1). `audible` — fayl to'lqinidan o'lchangan: signal ~0,2 s da so'nadi, xato — uch
 * qisqa «bip», ~0,62 s (fayl oxiri — jimlik).
 */
export const BEEPOST_SOUNDS = {
  success: { url: publicFile("sound/scanner/beepost-success.mp3"), volume: 0.7, audible: 0.2 },
  error: { url: publicFile("sound/scanner/beepost-error.mp3"), volume: 1, audible: 0.62 },
} as const satisfies Record<"success" | "error", ScanSoundFile>;

/**
 * «OVOZLI XABAR» iboralari (o'zbekcha, Microsoft uz-UZ-MadinaNeural, `public/sound/voice/uz/<ibora>.mp3`):
 * received «Qabul qilindi» · selected «Tanlandi» · assigned «Biriktirildi» · added «Qo'shildi» · done «Bajarildi» ·
 * duplicate «Allaqachon skanerlangan» · missing «Bu ro'yxatda yo'q» · error «Xatolik bo'ldi».
 */
export const SCAN_VOICE_PHRASES = [
  "received",
  "selected",
  "assigned",
  "added",
  "done",
  "duplicate",
  "missing",
  "error",
] as const;
export type ScanVoicePhrase = (typeof SCAN_VOICE_PHRASES)[number];

export const scanVoiceUrl = (phrase: ScanVoicePhrase) => publicFile(`sound/voice/uz/${phrase}.mp3`);

/** Chaqiruvchi ibora bermasa — natija turi bo'yicha. */
const DEFAULT_VOICE: Record<ScanFeedbackType, ScanVoicePhrase> = {
  success: "done",
  duplicate: "duplicate",
  missing: "missing",
  error: "error",
};

/** Aytiladigan ibora: aniq berilgani, aks holda tur bo'yicha; `false` — aytilmaydi. */
export const resolveScanVoice = (type: ScanFeedbackType, voice?: ScanVoicePhrase | false): ScanVoicePhrase | null =>
  voice === false ? null : (voice ?? DEFAULT_VOICE[type]);

const SUCCESS_TONES: Record<ToneSoundId, Tone[]> = {
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

const ERROR_TONES: Record<ToneSoundId, Tone[]> = {
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
const DUPLICATE_TONES: Partial<Record<ToneSoundId, Tone[]>> = {
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

/** Natija ovozi: sintez ohanglar yoki mp3 fayl (yuklanmasa yoki dekodlanmasa — `fallback` ohanglar). */
export type ScanFeedbackSound =
  | { kind: "tones"; tones: Tone[] }
  | { kind: "file"; file: ScanSoundFile; fallback: Tone[] };

const toneSound = (tones: Tone[]): ScanFeedbackSound => ({ kind: "tones", tones });

/**
 * Natija turi uchun ovoz — tanlangan (saqlangan) ovozdan; saqlanmagan yoki noma'lum bo'lsa `DEFAULT_SCANNER_SOUND`
 * (`beepost`). Muvaffaqiyat va «takror» — muvaffaqiyat ovozi tanlovidan, xato va «ro'yxatda yo'q» — xato ovozi
 * tanlovidan. `sound` — saqlangan tanlov o'rniga (faqat «Eshitib ko'rish»).
 *
 * BeePost'da ham shunday: «allaqachon qabul qilingan» — muvaffaqiyat signali (sariq xabar bilan), «topilmadi» — xato
 * signali (`global-scanner`). Shuning uchun `beepost` da «takror» — signal fayli, «ro'yxatda yo'q» — xato fayli;
 * farqni «Ovozli xabar» aytadi («Allaqachon skanerlangan», «Bu ro'yxatda yo'q»). Boshqa ovozlarda avvalgidek.
 */
export const getScanFeedbackSound = (type: ScanFeedbackType, sound?: ScannerSoundId): ScanFeedbackSound => {
  if (type === "success" || type === "duplicate") {
    const id = sound ?? readStoredScannerSuccessSound() ?? DEFAULT_SCANNER_SOUND;
    if (id === "beepost") return { kind: "file", file: BEEPOST_SOUNDS.success, fallback: SUCCESS_TONES.classic };
    return toneSound(type === "duplicate" ? (DUPLICATE_TONES[id] ?? SUCCESS_TONES[id]) : SUCCESS_TONES[id]);
  }
  const id = sound ?? readStoredScannerErrorSound() ?? DEFAULT_SCANNER_SOUND;
  if (type === "missing") {
    return id === "beepost"
      ? { kind: "file", file: BEEPOST_SOUNDS.error, fallback: MISSING_TONES }
      : toneSound(MISSING_TONES);
  }
  if (id === "beepost") return { kind: "file", file: BEEPOST_SOUNDS.error, fallback: ERROR_TONES.classic };
  return toneSound(ERROR_TONES[id]);
};

/**
 * Natija turi uchun sintez ohanglar — tanlangan ovozdan; `beepost` (fayl) da — fayl yuklanmagandagi zaxira
 * (`classic`, «ro'yxatda yo'q» — o'z ohangi).
 */
export const getScanFeedbackTones = (type: ScanFeedbackType): Tone[] => {
  const sound = getScanFeedbackSound(type);
  return sound.kind === "tones" ? sound.tones : sound.fallback;
};

const FEEDBACK_VIBRATION: Record<ScanFeedbackType, number | number[]> = {
  success: 40,
  // Maket `common-settings-scanner`: «xato — uch marta».
  error: [60, 45, 60, 45, 80],
  missing: [35, 55, 35, 55, 70],
  duplicate: [35, 55, 35, 55, 70],
};

const stopActiveFeedback = () => {
  activeSources.forEach((source) => {
    try {
      source.stop();
    } catch {
      // source already stopped
    }
  });
  activeSources.clear();
};

const track = (source: AudioScheduledSourceNode) => {
  activeSources.add(source);
  source.addEventListener("ended", () => activeSources.delete(source), { once: true });
};

/** Ohanglarni `start` dan rejalashtiradi; qaytaradi — oxirgi ohang tugaydigan payt (AudioContext vaqti). */
const scheduleTones = (context: AudioContext, tones: Tone[], startAt: number, volumeScale: number): number => {
  const output = audioOutput;
  if (!output) return startAt;
  let lastEnd = startAt;

  tones.forEach((tone) => {
    const start = startAt + tone.start;
    const end = start + tone.duration;
    lastEnd = Math.max(lastEnd, end);
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

    oscillator.start(start);
    oscillator.stop(end);
    track(oscillator);
  });
  return lastEnd;
};

/* ─── mp3 fayllar: yuklash (tarmoq) va dekodlash (AudioContext) ───────────────────────────────────────────── */

/** Tarmoqdan olingan xom fayllar — AudioContext'siz ham (oldindan yuklash foydalanuvchi bosishini kutmaydi). */
const fetchedFiles = new Map<string, Promise<ArrayBuffer | null>>();
/** Dekodlangan fayllar — keyingi signal ularni darhol (sinxron) chaladi. */
const decodedFiles = new Map<string, AudioBuffer>();
const decodingFiles = new Map<string, Promise<AudioBuffer | null>>();
/** Brauzer dekodlay olmagan fayllar — qayta urinilmaydi, zaxira ohang chalinadi. */
const brokenFiles = new Set<string>();

const FETCH_TIMEOUT_MS = 5000;

const fetchFile = (url: string): Promise<ArrayBuffer | null> => {
  let pending = fetchedFiles.get(url);
  if (!pending) {
    // Osilib qolgan so'rov umumiy promise'ni ushlab turmasin — 5 s dan keyin bekor, keyingi signal qayta urinadi.
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : null;
    pending = fetch(url, controller ? { signal: controller.signal } : undefined)
      .then((response) => (response.ok ? response.arrayBuffer() : null))
      .catch(() => null)
      .finally(() => {
        if (timer) clearTimeout(timer);
      })
      .then((data) => {
        // Tarmoq xatosi — keyingi signal qayta urinadi.
        if (!data) fetchedFiles.delete(url);
        return data;
      });
    fetchedFiles.set(url, pending);
  }
  return pending;
};

const decodeData = (context: AudioContext, data: ArrayBuffer) =>
  new Promise<AudioBuffer | null>((resolve) => {
    try {
      // Eski Safari faqat callback shaklini biladi; yangilari Promise ham qaytaradi (rad etilishi ushlanadi).
      const result = context.decodeAudioData(data, resolve, () => resolve(null)) as Promise<AudioBuffer> | undefined;
      if (result && typeof result.then === "function") result.then(resolve, () => resolve(null));
    } catch {
      resolve(null);
    }
  });

/** Dekodlangan fayl; yuklanmasa yoki brauzer dekodlay olmasa — `null` (zaxira ohang yoki jim). */
const loadFile = (context: AudioContext, url: string): Promise<AudioBuffer | null> => {
  const ready = decodedFiles.get(url);
  if (ready) return Promise.resolve(ready);
  if (brokenFiles.has(url) || typeof context.decodeAudioData !== "function" || typeof fetch !== "function") {
    return Promise.resolve(null);
  }
  let pending = decodingFiles.get(url);
  if (!pending) {
    pending = fetchFile(url).then(async (data) => {
      const buffer = data ? await decodeData(context, data) : null;
      decodingFiles.delete(url);
      if (buffer) decodedFiles.set(url, buffer);
      else if (data) {
        // `decodeAudioData` xom ma'lumotni egallaydi — qayta dekodlab bo'lmaydi, fayl ham tuzalmaydi.
        fetchedFiles.delete(url);
        brokenFiles.add(url);
      }
      return buffer;
    });
    decodingFiles.set(url, pending);
  }
  return pending;
};

/** Oldindan yuklangan (hali dekodlanmagan) fayllarni dekodlaydi — ovoz qulfi ochilganda. */
const decodeFetchedFiles = (context: AudioContext) => {
  fetchedFiles.forEach((_, url) => void loadFile(context, url));
};

const FEEDBACK_TYPES: ScanFeedbackType[] = ["success", "duplicate", "missing", "error"];

/**
 * Skan sahifasi (skan maqsadi, Mini App) ochilganda kerakli fayllar oldindan yuklanadi — birinchi skan ham darhol
 * chalinsin: tanlangan BeePost ovozlari va (yoqiq bo'lsa) «Ovozli xabar» iboralari. «Ovoz» o'chiq — hech narsa.
 * Tarmoqqa chiqadi, AudioContext yaratmaydi (u foydalanuvchi bosishini kutadi); kontekst bo'lsa — darhol dekodlaydi.
 */
export const preloadScanFeedbackAudio = () => {
  if (!getAudioContextCtor() || typeof fetch !== "function") return;
  const prefs = readStoredScannerFeedbackPrefs();
  if (!prefs.sound) return;
  const urls = new Set<string>();
  FEEDBACK_TYPES.forEach((type) => {
    const sound = getScanFeedbackSound(type);
    if (sound.kind === "file") urls.add(sound.file.url);
  });
  if (prefs.voice) SCAN_VOICE_PHRASES.forEach((phrase) => urls.add(scanVoiceUrl(phrase)));
  urls.forEach((url) => {
    if (brokenFiles.has(url)) return;
    if (audioContext) void loadFile(audioContext, url);
    else void fetchFile(url);
  });
};

const playFile = (context: AudioContext, buffer: AudioBuffer, startAt: number, volume: number) => {
  const output = fileOutput;
  if (!output) return;
  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(output);
  source.start(startAt);
  track(source);
};

/** «Ovozli xabar»: signal so'ngach shuncha (s) jimlik — ibora faylining o'zida ham ~0,1 s jimlik bor. */
const VOICE_GAP_S = 0.04;
const VOICE_VOLUME = 1;
/** Yuklanib shuncha (s) kechikkan signal yoki ibora endi chalinmaydi — natija allaqachon eskirgan. */
const STALE_S = 1.5;
/** Dekodlanmagan signal fayli shuncha (ms) kutiladi — keyin zaxira ohang (sekin tarmoqda skan jim qolmasin). */
const FILE_WAIT_MS = 150;

type FeedbackPlan = {
  type: ScanFeedbackType;
  sound: ScanFeedbackSound;
  voice: ScanVoicePhrase | null;
  preview: boolean;
};

/**
 * Signal (ohang yoki fayl), so'ng ibora. Signal tarmoqni uzoq kutmaydi: fayl FILE_WAIT_MS ichida tayyor bo'lmasa zaxira
 * ohang chalinadi («Eshitib ko'rish» bundan mustasno — u faylni kutadi). Ibora yuklanayotgan bo'lsa — yuklangach, agar
 * shu orada yangi signal kelmagan va natija eskirmagan bo'lsa.
 */
const runFeedback = async (context: AudioContext, plan: FeedbackPlan, gen: number) => {
  stopActiveFeedback();
  const requestedAt = context.currentTime;
  const volumeScale = plan.type === "success" ? 0.7 : 1;
  let soundEnd: number;

  if (plan.sound.kind === "tones") {
    soundEnd = scheduleTones(context, plan.sound.tones, requestedAt + 0.002, volumeScale);
  } else {
    const { file, fallback } = plan.sound;
    let buffer = decodedFiles.get(file.url) ?? null;
    if (!buffer) {
      // Skan tarmoqni kutmaydi: oldindan yuklangan fayl millisoniyalarda dekodlanadi, aks holda FILE_WAIT_MS dan keyin
      // zaxira ohang chalinadi, fayl esa keyingi skanga yuklanishda davom etadi. «Eshitib ko'rish» faylni kutadi.
      const loading = loadFile(context, file.url);
      buffer = plan.preview
        ? await loading
        : await Promise.race([loading, new Promise<null>((resolve) => setTimeout(() => resolve(null), FILE_WAIT_MS))]);
      if (gen !== generation) return;
    }
    const startAt = context.currentTime + 0.002;
    if (buffer) {
      playFile(context, buffer, startAt, file.volume);
      soundEnd = startAt + Math.min(file.audible, buffer.duration);
    } else {
      soundEnd = scheduleTones(context, fallback, startAt, volumeScale);
    }
  }

  if (!plan.voice) return;
  const url = scanVoiceUrl(plan.voice);
  const voice = decodedFiles.get(url) ?? (await loadFile(context, url));
  if (!voice || gen !== generation) return;
  if (!plan.preview && context.currentTime - soundEnd > STALE_S) return;
  playFile(context, voice, Math.max(soundEnd + VOICE_GAP_S, context.currentTime + 0.002), VOICE_VOLUME);
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
  /**
   * «Ovozli xabar» iborasi (signaldan keyin aytiladi): qabul — `received`, ro'yxatga tanlash — `selected`, kuryerga
   * biriktirish — `assigned`, ro'yxatga qo'shish — `added`. Berilmasa — tur bo'yicha (success → `done`, duplicate,
   * missing, error); `false` — aytilmaydi. Sozlamalarda «Ovozli xabar» yoki «Ovoz» o'chiq bo'lsa — aytilmaydi;
   * «Eshitib ko'rish» (`preview`) da faqat aniq berilgan ibora aytiladi.
   */
  voice?: ScanVoicePhrase | false;
  /** Saqlangan tanlov o'rniga shu ovoz — faqat «Eshitib ko'rish» (Sozlamalar), tanlov o'zgarmaydi. */
  sound?: ScannerSoundId;
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
 * Sozlamalar → Skaner: «Ovoz» o'chiq — ohang ham, ibora ham yo'q; «Ovozli xabar» o'chiq — ibora yo'q;
 * «Tebranish» o'chiq — tebranish yo'q. Hech qachon kuttirmaydi va xato tashlamaydi (brauzer ovozni bloklasa — jim).
 */
export const playScanSignal = (type: ScanFeedbackType, options: ScanSignalOptions = {}) => {
  const prefs = readStoredScannerFeedbackPrefs();
  if (typeof window !== "undefined" && options.vibrate !== false && (prefs.vibration || options.preview)) {
    window.navigator.vibrate?.(FEEDBACK_VIBRATION[type]);
  }
  if (!prefs.sound && !options.preview) return;

  const context = getAudioContext();
  if (!context) return;

  const plan: FeedbackPlan = {
    type,
    sound: getScanFeedbackSound(type, options.sound),
    voice: options.preview ? options.voice || null : prefs.voice ? resolveScanVoice(type, options.voice) : null,
    preview: Boolean(options.preview),
  };
  const gen = ++generation;
  const run = () => runFeedback(context, plan, gen).catch(() => undefined);

  if (context.state === "running") {
    void run();
    return;
  }

  // Qulf ochilishini (foydalanuvchi bosishi) kutgan signal keyinroq, eskirgan holda chalinmasin.
  const requestedAt = Date.now();
  void context
    .resume()
    .then(() => (gen === generation && Date.now() - requestedAt <= STALE_S * 1000 ? run() : undefined))
    .catch(() => undefined);
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
