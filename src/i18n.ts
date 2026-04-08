import i18n, { type Resource } from "i18next";
import { initReactI18next } from "react-i18next";

const LANGUAGE_STORAGE_KEY = "app-language";
const DEFAULT_LANGUAGE = "uz";
const FALLBACK_LANGUAGE = "uz";
const SUPPORTED_LANGUAGES = ["uz", "en", "ru"] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const localeModules = import.meta.glob<{ default: Record<string, string | object> }>(
  "./locales/*/*.json",
  { eager: true },
);

const resources = Object.entries(localeModules).reduce<Resource>(
  (accumulator, [modulePath, moduleValue]) => {
    const match = modulePath.match(/\.\/locales\/([^/]+)\/([^/]+)\.json$/);

    if (!match) {
      return accumulator;
    }

    const [, language, namespace] = match;

    if (namespace === language) {
      return accumulator;
    }

    if (!accumulator[language]) {
      accumulator[language] = {};
    }

    accumulator[language][namespace] = moduleValue.default;

    return accumulator;
  },
  {},
);

const normalizeLanguage = (language?: string | null): SupportedLanguage => {
  const normalizedLanguage = language?.toLowerCase().split("-")[0];

  if (
    normalizedLanguage &&
    SUPPORTED_LANGUAGES.includes(normalizedLanguage as SupportedLanguage)
  ) {
    return normalizedLanguage as SupportedLanguage;
  }

  return DEFAULT_LANGUAGE;
};

const getInitialLanguage = () => {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);

  if (savedLanguage) {
    return normalizeLanguage(savedLanguage);
  }

  return DEFAULT_LANGUAGE;
};

void i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: FALLBACK_LANGUAGE,
  supportedLngs: [...SUPPORTED_LANGUAGES],
  nonExplicitSupportedLngs: true,
  load: "languageOnly",
  cleanCode: true,
  defaultNS: "common",
  ns: Object.keys(resources[DEFAULT_LANGUAGE] ?? {}),
  interpolation: {
    escapeValue: false,
  },
});

i18n.on("languageChanged", (language) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizeLanguage(language));
  }
});

export {
  LANGUAGE_STORAGE_KEY,
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  SUPPORTED_LANGUAGES,
  normalizeLanguage,
};
export default i18n;
