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
 * ⚠️ BUNDLE ICHIDA FAQAT O'ZBEKCHA YADRO (NIFAnCvf, rzzxMItN): `common`, `ui`, `auth`, `notifications` — kirish
 * sahifasi, yuklanish ekrani, xato sahifalari va har doim chiziladigan global qatlam (xabarlar, jonli kanal, push).
 * Qolgan uz nomlar fazosi — bitta chunk (`locales/uzRest.ts`, `loadAppLocales`), ilova chizilishidan OLDIN keladi
 * (`i18nReady`); faqat to'g'ridan-to'g'ri `/login` da kirish so'rovigacha kechiktiriladi — sekin tarmoqda login
 * ~64 KB gzip kam yuklaydi. ru / en — `lazyLocaleBackend` orqali faqat kerak bo'lganda (har til bitta
 * `locale-<til>` chunk, vite.config.ts).
 */
const localeModules = import.meta.glob<{ default: Record<string, string | object> }>(
  "./locales/uz/{common,ui,auth,notifications}.json",
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
    if (language === DEFAULT_LANGUAGE) {
      loadAppLocales().then(
        () => callback(null, i18n.getResourceBundle(language, namespace) ?? {}),
        (error: unknown) => callback(error as Error, null),
      );
      return;
    }
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

let appLocales: Promise<void> | null = null;

/**
 * O'zbekcha tarjimalarning yadrodan tashqari qismi (bir marta, bitta chunk). Modul darajasida `i18n.t("ns:…")`
 * chaqiradigan kod bor (yup sxemalari) — sahifa kodi yuklanishidan OLDIN tugashi kerak. `loadNamespaces` — tanlangan
 * til (ru/en) ham shu nomlar fazosi bilan birga keladi (`changeLanguage` ularni ham yuklaydi). Xato bo'lsa — keyingi
 * chaqiruv qayta urinadi.
 */
const loadAppLocales = (): Promise<void> => {
  appLocales ??= import("./locales/uzRest").then(
    async ({ default: bundles }) => {
      for (const [namespace, bundle] of Object.entries(bundles)) {
        i18n.addResourceBundle(DEFAULT_LANGUAGE, namespace, bundle, true, false);
      }
      await i18n.loadNamespaces(Object.keys(bundles));
    },
    (error: unknown) => {
      appLocales = null;
      throw error;
    },
  );
  return appLocales;
};

/** To'g'ridan-to'g'ri `/login` ochildi — tarjimalarning qolgani kirish so'rovigacha kutadi (`authService.login`). */
const startsOnLogin = () =>
  typeof window !== "undefined" && /^\/login\/?$/i.test(window.location.pathname);

/** Boshlang'ich til (ru/en bo'lsa — uning fayllari) va (`/login` dan boshqa joyda) barcha uz tarjimalar yuklangach. */
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
}).then((t) => (startsOnLogin() ? t : loadAppLocales().then(() => t)));

const changeAppLanguage = (language: string) => {
  const normalizedLanguage = normalizeLanguage(language);
  writeStoredLanguage(normalizedLanguage);
  return i18n.changeLanguage(normalizedLanguage);
};

export {
  i18nReady,
  loadAppLocales,
  startsOnLogin,
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  SUPPORTED_LANGUAGES,
  changeAppLanguage,
  normalizeLanguage,
};
export default i18n;
