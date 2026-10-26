import { createRoot } from "react-dom/client";
import i18n, { i18nReady } from "../../../i18n";
import { StagingBanner } from "../ui/StagingBanner";
import { STAGING_LOCALES, STAGING_NAMESPACE } from "./locales";

/**
 * TEST MUHIT (staging) — ekrandagi belgi va hujjat sarlavhasi.
 *
 * `src/main.tsx` bu modulni FAQAT `import.meta.env.VITE_APP_ENV === "staging"` bo'lganda dinamik import qiladi.
 * Shart build vaqtida hisoblanadi (`.env.production` → `VITE_APP_ENV=production`): production bundle'da na shu chunk,
 * na uning chaqiruvi bor. Ilova daraxtiga (`App`, shell) tegmaslik uchun belgi o'z React ildizida chiziladi.
 * Build tomoni (noindex, manifest, sw.js, `_headers`) — `scripts/staging-build.mjs`.
 */

/** Sarlavha prefiksi — `scripts/staging-build.mjs` dagi `STAGING_TITLE_PREFIX` bilan bir xil (test solishtiradi). */
export const STAGING_TITLE_PREFIX = "[TEST] ";

export const isStagingEnv = (value: unknown) => value === "staging";

/**
 * Brauzer yorlig'i va tarix doim «[TEST] …»: `index.html` sarlavhasi build'da prefiksli, sahifa nomlarini esa
 * `shared/lib/documentTitle.ts` yozadi — u production kodi, unga tegilmaydi; yozilgan har yangi sarlavhaga prefiks shu
 * yerda qo'shiladi. Qaytgan funksiya kuzatuvni to'xtatadi.
 */
export const keepStagingTitlePrefix = (doc: Document = document) => {
  const apply = () => {
    if (!doc.title.startsWith(STAGING_TITLE_PREFIX)) doc.title = `${STAGING_TITLE_PREFIX}${doc.title}`;
  };
  apply();
  const observer = new MutationObserver(apply);
  observer.observe(doc.head, { childList: true, characterData: true, subtree: true });
  return () => observer.disconnect();
};

/**
 * Staging'da belgini o'rnatadi (tarjimalar → sarlavha prefiksi → `<body>` oxirida alohida ildiz; chizish ilova
 * tarjimalari tayyor bo'lgach, ilova bilan bir vaqtda). Staging bo'lmasa — hech narsa qilmaydi, `null`.
 * Qaytgan funksiya hammasini olib tashlaydi (testlar uchun).
 */
export const mountStagingBanner = (env: unknown = import.meta.env.VITE_APP_ENV) => {
  if (!isStagingEnv(env)) return null;

  for (const [language, bundle] of Object.entries(STAGING_LOCALES)) {
    i18n.addResourceBundle(language, STAGING_NAMESPACE, bundle, true, true);
  }
  const stopTitle = keepStagingTitlePrefix();
  const host = document.createElement("div");
  host.setAttribute("data-staging-root", "");
  document.body.appendChild(host);
  const root = createRoot(host);
  let active = true;
  const render = () => {
    if (active) root.render(<StagingBanner />);
  };
  void i18nReady.then(render, render);

  return () => {
    active = false;
    stopTitle();
    root.unmount();
    host.remove();
  };
};
