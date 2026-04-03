import i18n, { type Resource } from "i18next";
import { initReactI18next } from "react-i18next";

const LANGUAGE_STORAGE_KEY = "app-language";
const DEFAULT_LANGUAGE = "uz";
const FALLBACK_LANGUAGE = "en";
const SUPPORTED_LANGUAGES = ["uz", "en", "ru"] as const;

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

const getInitialLanguage = () => {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);

  if (savedLanguage && SUPPORTED_LANGUAGES.includes(savedLanguage as (typeof SUPPORTED_LANGUAGES)[number])) {
    return savedLanguage;
  }

  const browserLanguage = window.navigator.language.toLowerCase().split("-")[0];

  if (SUPPORTED_LANGUAGES.includes(browserLanguage as (typeof SUPPORTED_LANGUAGES)[number])) {
    return browserLanguage;
  }

  return DEFAULT_LANGUAGE;
};

void i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: FALLBACK_LANGUAGE,
  defaultNS: "common",
  ns: Object.keys(resources[DEFAULT_LANGUAGE] ?? {}),
  interpolation: {
    escapeValue: false,
  },
});

i18n.on("languageChanged", (language) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }
});

export { LANGUAGE_STORAGE_KEY, DEFAULT_LANGUAGE, FALLBACK_LANGUAGE };
export default i18n;
