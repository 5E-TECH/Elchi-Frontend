export type StoredTheme = "light" | "dark";
export type StoredLanguage = "uz" | "ru" | "en";
/**
 * Skaner ovozlari. `beepost` — BeePost skaneridagi mp3 fayllar (`public/sound/scanner`, sukut); keyingi 6 tasi — eski
 * (saqlangan tanlovlar shu ID'lar bilan ishlayveradi), oxirgilari — yumshoq to'plamlar (JX0EBpa7: qisqa, ≤ 250 ms,
 * «takror» ohangi bilan). Ro'yxatda yo'q qiymat — sukut (`DEFAULT_SCANNER_SOUND`).
 */
export const STORED_SCANNER_SOUNDS = [
  "beepost",
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
] as const;
export type StoredScannerSound = (typeof STORED_SCANNER_SOUNDS)[number];
/** Sukut ovozi — tanlov saqlanmagan foydalanuvchida (ega qarori 2026-11-04: BeePost ovozlari). */
export const DEFAULT_SCANNER_SOUND: StoredScannerSound = "beepost";
/**
 * Avvalgi sukut. Sozlama har yozuvda hisobga TO'LIQ ketardi (`useUpdateSettings`), shuning uchun hisobdagi `classic`
 * — tanlovmi yoki eski sukutmi, ajratib bo'lmaydi: u faqat aniq tanlov belgisi (`scanner.sounds.chosen`) bilan
 * hurmat qilinadi, aks holda — yangi sukut. Boshqa ovozlar (ular faqat tanlab qo'yiladi) har doim hurmat qilinadi.
 */
const LEGACY_DEFAULT_SCANNER_SOUND: StoredScannerSound = "classic";
/** Asosiy kamera: orqa (`environment`, tavsiya) yoki old (`user`). */
export type StoredCameraFacing = "environment" | "user";
/** Skaner ramkasi o'lchami: kichik · o'rta · katta. */
export type StoredScanFrameSize = "sm" | "md" | "lg";

export const PREFERENCE_STORAGE_KEYS = {
  theme: "theme",
  /** Dizayn v2: shu versiyasiz saqlangan mavzu e'tiborga olinmaydi (sukut — light). */
  themeVersion: "theme-version",
  language: "app-language",
  sidebar: "sidebarIsOpen",
  scannerSuccessSound: "scanner-success-sound",
  scannerErrorSound: "scanner-error-sound",
  scannerCameraFacing: "scanner-camera-facing",
  scannerFrameSize: "scanner-frame-size",
  scannerTorchAuto: "scanner-torch-auto",
  scannerContinuous: "scanner-continuous",
  scannerSoundEnabled: "scanner-sound-enabled",
  scannerVibration: "scanner-vibration",
  scannerVoice: "scanner-voice-enabled",
  dashboardComparison: "dashboard-comparison",
  /**
   * Global qidiruvning «So'nggi qidiruvlar» (`widgets/header`) — mijoz ismi / telefoni bo'lishi mumkin: chiqishda
   * (va sessiya tugaganda) tozalanadi, filialdagi umumiy kompyuterda keyingi xodim ko'rmasin.
   */
  recentSearches: "elchi:header:recent-searches",
} as const;

const read = (key: string) => {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // UI preferences must not break the app when storage is unavailable.
  }
};

/**
 * Dizayn v2 (ega qarori: sukut — LIGHT). Ilgari sukut dark edi va u
 * localStorage'ga hamda serverga AVTOMATIK yozilardi — ya'ni saqlangan "dark"
 * foydalanuvchi tanlovimi yoki eski sukutmi, ajratib bo'lmaydi. Shuning uchun
 * faqat v2 versiya belgisi bilan yozilgan qiymat hurmat qilinadi; eskisi bir
 * marta light'ga qaytadi (foydalanuvchi Sozlamalar'dan qayta tanlaydi).
 */
export const THEME_STORAGE_VERSION = "2";

export const readStoredTheme = (): StoredTheme | null => {
  if (read(PREFERENCE_STORAGE_KEYS.themeVersion) !== THEME_STORAGE_VERSION) return null;
  const value = read(PREFERENCE_STORAGE_KEYS.theme);
  return value === "light" || value === "dark" ? value : null;
};

export const writeStoredTheme = (theme: StoredTheme) => {
  write(PREFERENCE_STORAGE_KEYS.theme, theme);
  write(PREFERENCE_STORAGE_KEYS.themeVersion, THEME_STORAGE_VERSION);
};

export const readStoredLanguage = (): StoredLanguage | null => {
  const value = read(PREFERENCE_STORAGE_KEYS.language);
  return value === "uz" || value === "ru" || value === "en" ? value : null;
};

export const writeStoredLanguage = (language: StoredLanguage) => {
  write(PREFERENCE_STORAGE_KEYS.language, language);
};

export const readStoredSidebar = (): boolean | null => {
  const value = read(PREFERENCE_STORAGE_KEYS.sidebar);
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
};

export const writeStoredSidebar = (isOpen: boolean) => {
  write(PREFERENCE_STORAGE_KEYS.sidebar, String(isOpen));
};

export const readStoredDashboardComparison = (): boolean | null => {
  const value = read(PREFERENCE_STORAGE_KEYS.dashboardComparison);
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
};

export const writeStoredDashboardComparison = (enabled: boolean) => {
  write(PREFERENCE_STORAGE_KEYS.dashboardComparison, String(enabled));
};

export const isScannerSound = (value: unknown): value is StoredScannerSound =>
  typeof value === "string" && (STORED_SCANNER_SOUNDS as readonly string[]).includes(value);

const normalizeScannerSound = (value: string | null): StoredScannerSound | null =>
  isScannerSound(value) ? value : null;

export const readStoredScannerSuccessSound = (): StoredScannerSound | null =>
  normalizeScannerSound(read(PREFERENCE_STORAGE_KEYS.scannerSuccessSound));

/**
 * Hisobdagi (`admins.settings.scanner.sounds`) ovoz → amaldagi ovoz. Noma'lum qiymat — `null` (chaqiruvchi sukutni
 * yoki qurilmadagi qiymatni qo'yadi); tanlov belgisisiz `classic` — eski avtomatik sukut, endi `DEFAULT_SCANNER_SOUND`.
 */
export const resolveAccountScannerSound = (value: unknown, chosen: unknown): StoredScannerSound | null => {
  if (!isScannerSound(value)) return null;
  return value === LEGACY_DEFAULT_SCANNER_SOUND && chosen !== true ? DEFAULT_SCANNER_SOUND : value;
};

export const writeStoredScannerSuccessSound = (sound: StoredScannerSound) => {
  write(PREFERENCE_STORAGE_KEYS.scannerSuccessSound, sound);
};

export const readStoredScannerErrorSound = (): StoredScannerSound | null =>
  normalizeScannerSound(read(PREFERENCE_STORAGE_KEYS.scannerErrorSound));

export const writeStoredScannerErrorSound = (sound: StoredScannerSound) => {
  write(PREFERENCE_STORAGE_KEYS.scannerErrorSound, sound);
};

/**
 * KAMERA SOZLAMALARI (Sozlamalar → Skaner → «Kamera», maket `common-settings-scanner`). Manba — `entities/settings`
 * (`scanner.camera`, `scanner.feedback`, backend `admins.settings`); bu yerda — ko'zgusi: `SettingsSync` va sozlamalar
 * sahifasi yozadi, `shared` qatlami (kamera, skan signali) o'qiydi — `entities` ga bog'lanmasdan (FSD).
 */
export type StoredScannerCameraPrefs = {
  facing: StoredCameraFacing;
  frame: StoredScanFrameSize;
  /** Chiroqli qurilmada yorug'lik kam bo'lsa chiroqni yoqish taklif qilinadi. */
  torchAuto: boolean;
  /** `false` — oqim ichidagi kamera bitta muvaffaqiyatli koddan keyin yopiladi. */
  continuous: boolean;
};

export type StoredScannerFeedbackPrefs = {
  sound: boolean;
  vibration: boolean;
  /** «Ovozli xabar»: signaldan keyin natija o'zbekcha aytiladi («Qabul qilindi», «Xatolik bo'ldi»). */
  voice: boolean;
};

export const DEFAULT_SCANNER_CAMERA_PREFS: StoredScannerCameraPrefs = {
  facing: "environment",
  frame: "md",
  torchAuto: true,
  continuous: true,
};

export const DEFAULT_SCANNER_FEEDBACK_PREFS: StoredScannerFeedbackPrefs = {
  sound: true,
  vibration: true,
  voice: true,
};

const readStoredBool = (key: string, fallback: boolean) => {
  const value = read(key);
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
};

export const readStoredScannerCameraPrefs = (): StoredScannerCameraPrefs => {
  const facing = read(PREFERENCE_STORAGE_KEYS.scannerCameraFacing);
  const frame = read(PREFERENCE_STORAGE_KEYS.scannerFrameSize);
  const d = DEFAULT_SCANNER_CAMERA_PREFS;
  return {
    facing: facing === "environment" || facing === "user" ? facing : d.facing,
    frame: frame === "sm" || frame === "md" || frame === "lg" ? frame : d.frame,
    torchAuto: readStoredBool(PREFERENCE_STORAGE_KEYS.scannerTorchAuto, d.torchAuto),
    continuous: readStoredBool(PREFERENCE_STORAGE_KEYS.scannerContinuous, d.continuous),
  };
};

export const writeStoredScannerCameraPrefs = (prefs: Partial<StoredScannerCameraPrefs>) => {
  if (prefs.facing) write(PREFERENCE_STORAGE_KEYS.scannerCameraFacing, prefs.facing);
  if (prefs.frame) write(PREFERENCE_STORAGE_KEYS.scannerFrameSize, prefs.frame);
  if (prefs.torchAuto !== undefined) write(PREFERENCE_STORAGE_KEYS.scannerTorchAuto, String(prefs.torchAuto));
  if (prefs.continuous !== undefined) write(PREFERENCE_STORAGE_KEYS.scannerContinuous, String(prefs.continuous));
};

export const readStoredScannerFeedbackPrefs = (): StoredScannerFeedbackPrefs => ({
  sound: readStoredBool(PREFERENCE_STORAGE_KEYS.scannerSoundEnabled, DEFAULT_SCANNER_FEEDBACK_PREFS.sound),
  vibration: readStoredBool(PREFERENCE_STORAGE_KEYS.scannerVibration, DEFAULT_SCANNER_FEEDBACK_PREFS.vibration),
  voice: readStoredBool(PREFERENCE_STORAGE_KEYS.scannerVoice, DEFAULT_SCANNER_FEEDBACK_PREFS.voice),
});

export const writeStoredScannerFeedbackPrefs = (prefs: Partial<StoredScannerFeedbackPrefs>) => {
  if (prefs.sound !== undefined) write(PREFERENCE_STORAGE_KEYS.scannerSoundEnabled, String(prefs.sound));
  if (prefs.vibration !== undefined) write(PREFERENCE_STORAGE_KEYS.scannerVibration, String(prefs.vibration));
  if (prefs.voice !== undefined) write(PREFERENCE_STORAGE_KEYS.scannerVoice, String(prefs.voice));
};

export const clearStoredUiPreferences = () => {
  if (typeof window === "undefined") return;

  try {
    Object.values(PREFERENCE_STORAGE_KEYS).forEach((key) => {
      window.localStorage.removeItem(key);
    });
  } catch {
    // UI preferences must not break logout when storage is unavailable.
  }
};
