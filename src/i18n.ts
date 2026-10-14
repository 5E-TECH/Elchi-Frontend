import i18n, { type BackendModule, type Resource } from "i18next";
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

/**
 * ⚠️ FAQAT STANDART TIL (uz) BUNDLE ICHIDA (NIFAnCvf). Ilgari uchala til
 * (uz + ru + en) entry chunk'ga eager tushardi — foydalanuvchi bittasini
 * ishlatsa ham har sahifada ~150 KB gzip ortiqcha tarjima yuklanardi.
 * ru / en — `lazyLocaleBackend` orqali faqat kerak bo'lganda (har til bitta
 * `locale-<til>` chunk, vite.config.ts).
 */
const localeModules = import.meta.glob<{ default: Record<string, string | object> }>(
  "./locales/uz/*.json",
  { eager: true },
);
const lazyLocaleModules = import.meta.glob<{ default: Record<string, string | object> }>(
  "./locales/{en,ru}/*.json",
);

/**
 * i18next backend: `changeLanguage("ru")` til fayllarini YUKLAB BO'LGACH
 * yakunlanadi — chaqiruvchi (va testlar) matn tayyor bo'lishini kutadi.
 */
const lazyLocaleBackend: BackendModule = {
  type: "backend",
  init: () => undefined,
  read: (language, namespace, callback) => {
    const load = lazyLocaleModules[`./locales/${language}/${namespace}.json`];
    if (!load) {
      callback(null, {});
      return;
    }
    load()
      .then((module) => callback(null, module.default))
      .catch((error: unknown) => callback(error as Error, null));
  },
};

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

/** Boshlang'ich til (ru/en bo'lsa — uning fayllari) yuklangach bajariladi. */
const i18nReady = i18n.use(lazyLocaleBackend).use(initReactI18next).init({
  resources,
  // `resources` faqat uz — qolgan tillar backend'dan olinadi.
  partialBundledLanguages: true,
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
  i18nReady,
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  SUPPORTED_LANGUAGES,
  changeAppLanguage,
  normalizeLanguage,
};
export default i18n;
