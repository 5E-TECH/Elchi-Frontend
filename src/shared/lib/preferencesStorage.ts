export type StoredTheme = "light" | "dark";
export type StoredLanguage = "uz" | "ru" | "en";
export type StoredScannerSound = "classic" | "soft" | "digital" | "bell" | "pulse" | "bright";

export const PREFERENCE_STORAGE_KEYS = {
  theme: "theme",
  /** Dizayn v2: shu versiyasiz saqlangan mavzu e'tiborga olinmaydi (sukut — light). */
  themeVersion: "theme-version",
  language: "app-language",
  sidebar: "sidebarIsOpen",
  scannerSuccessSound: "scanner-success-sound",
  scannerErrorSound: "scanner-error-sound",
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
