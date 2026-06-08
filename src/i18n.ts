import i18n, { type Resource } from "i18next";
import { initReactI18next } from "react-i18next";
import {
  readStoredLanguage,
  writeStoredLanguage,
  type StoredLanguage,
} from "./shared/lib/preferencesStorage";

const DEFAULT_LANGUAGE = "uz";
const FALLBACK_LANGUAGE = "uz";
const SUPPORTED_LANGUAGES = ["uz", "en", "ru"] as const;
type SupportedLanguage = StoredLanguage;

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

  const savedLanguage = readStoredLanguage();

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

const changeAppLanguage = (language: string) => {
  const normalizedLanguage = normalizeLanguage(language);
  writeStoredLanguage(normalizedLanguage);
  return i18n.changeLanguage(normalizedLanguage);
};

export {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  SUPPORTED_LANGUAGES,
  changeAppLanguage,
  normalizeLanguage,
};
export default i18n;
