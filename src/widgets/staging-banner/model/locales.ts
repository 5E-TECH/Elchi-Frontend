/**
 * «TEST muhit» belgisi matnlari (uz/ru/en). ATAYLAB `src/locales/*` da emas: belgi faqat staging build'ida bor
 * (`src/main.tsx` → dinamik import), tarjimalar ham shu chunk bilan keladi — production bundle'iga (uz yadrosi,
 * `locale-ru`/`locale-en`) bir bayt ham qo'shilmaydi. i18next'ga `staging` nomlar fazosi bo'lib qo'shiladi
 * (`mountStagingBanner`), til almashsa o'zi yangilanadi.
 */
export const STAGING_NAMESPACE = "staging";

export const STAGING_LOCALES = {
  uz: {
    label: "TEST muhit",
    description: "Sinov sayti: ma'lumotlar haqiqiy emas, bu yerdagi amallar ishchi tizimga ta'sir qilmaydi.",
  },
  ru: {
    label: "ТЕСТ-среда",
    description: "Тестовый сайт: данные ненастоящие, действия здесь не влияют на рабочую систему.",
  },
  en: {
    label: "TEST environment",
    description: "Test site: the data is not real and actions here do not affect the live system.",
  },
} as const satisfies Record<"uz" | "ru" | "en", Record<"label" | "description", string>>;
