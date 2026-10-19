export type StoredTheme = "light" | "dark";
export type StoredLanguage = "uz" | "ru" | "en";
export type StoredScannerSound = "classic" | "soft" | "digital" | "bell" | "pulse" | "bright";
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
  dashboardComparison: "dashboard-comparison",
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

const normalizeScannerSound = (value: string | null): StoredScannerSound | null => {
  if (
    value === "classic" ||
    value === "soft" ||
    value === "digital" ||
    value === "bell" ||
    value === "pulse" ||
    value === "bright"
  ) {
    return value;
  }
  return null;
};

export const readStoredScannerSuccessSound = (): StoredScannerSound | null =>
  normalizeScannerSound(read(PREFERENCE_STORAGE_KEYS.scannerSuccessSound));

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
});

export const writeStoredScannerFeedbackPrefs = (prefs: Partial<StoredScannerFeedbackPrefs>) => {
  if (prefs.sound !== undefined) write(PREFERENCE_STORAGE_KEYS.scannerSoundEnabled, String(prefs.sound));
  if (prefs.vibration !== undefined) write(PREFERENCE_STORAGE_KEYS.scannerVibration, String(prefs.vibration));
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
