/**
 * O'zbekcha tarjimalarning YADRODAN TASHQARI qismi (rzzxMItN) — bitta alohida chunk. Yadro (`common`, `ui`, `auth`,
 * `notifications`) entry ichida (`src/i18n.ts`); qolgani shu modul orqali `loadAppLocales()` bilan keladi. Ikki ro'yxat
 * bir-birini to'ldiradi — `src/i18n.test.ts` tekshiradi.
 */
const bundles = import.meta.glob<Record<string, unknown>>(
  ["./uz/*.json", "!./uz/{common,ui,auth,notifications}.json"],
  { eager: true, import: "default" },
);

export default Object.fromEntries(
  Object.entries(bundles).map(([path, bundle]) => [path.replace(/^\.\/uz\/|\.json$/g, ""), bundle]),
);
