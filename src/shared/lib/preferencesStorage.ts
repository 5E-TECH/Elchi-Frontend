export type StoredTheme = "light" | "dark";
export type StoredLanguage = "uz" | "ru" | "en";

export const PREFERENCE_STORAGE_KEYS = {
  theme: "theme",
  language: "app-language",
  sidebar: "sidebarIsOpen",
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

export const readStoredTheme = (): StoredTheme | null => {
  const value = read(PREFERENCE_STORAGE_KEYS.theme);
  return value === "light" || value === "dark" ? value : null;
};

export const writeStoredTheme = (theme: StoredTheme) => {
  write(PREFERENCE_STORAGE_KEYS.theme, theme);
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
