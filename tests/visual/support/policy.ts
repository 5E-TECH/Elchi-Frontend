/**
 * Vizual snapshotlar — baseline siyosati (sof funksiyalar; `playwright.visual.config.ts` va `test.ts` ishlatadi,
 * `policy.test.ts` tekshiradi). docs/DESIGN_SYSTEM.md §12.5.
 *
 * Baseline FAQAT CI'da, Playwright Docker obrazida yaratiladi: boshqa mashinada shrift/rasterlash farq qiladi.
 */
export type UpdateMode = "all" | "changed" | "missing" | "none";

const MODES: ReadonlySet<string> = new Set(["all", "changed", "missing", "none"]);

/** CLI argumentlaridan `--update-snapshots` rejimi (`-u` va qiymatsiz bayroq — `changed`); bayroq yo'q — `null`. */
export const updateModeFromArgv = (argv: readonly string[]): string | null => {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-u") {
      // `-u all` (Commander: qiymat keyingi argumentda) — rejim o'qiladi, aks holda `changed`.
      const next = argv[index + 1];
      return next !== undefined && MODES.has(next) ? next : "changed";
    }
    // `-uall`, `-uchanged` (Commander qisqa bayroq + qiymat yopishgan).
    if (/^-u[a-z]+$/.test(arg)) return arg.slice(2);
    if (arg.startsWith("--update-snapshots=")) return arg.slice("--update-snapshots=".length);
    if (arg === "--update-snapshots") {
      const next = argv[index + 1];
      return next !== undefined && MODES.has(next) ? next : "changed";
    }
  }
  return null;
};

export const UPDATE_REFUSED =
  "Vizual baseline faqat CI'da, Playwright Docker obrazida yangilanadi («Actions → Visual → Run workflow», update) — " +
  "docs/DESIGN_SYSTEM.md §12.5. Lokalda: VISUAL_DRY=1 npx playwright test -c playwright.visual.config.ts …";

type Env = Readonly<Record<string, string | undefined>>;

/**
 * Asosiy qoida: baseline yozadigan rejim (`none` dan boshqa) faqat `VISUAL_IN_DOCKER=1` bilan. `test.ts` har
 * sahnada Playwright o'zi tahlil qilgan `testInfo.config.updateSnapshots` bilan chaqiradi — argv tahlilini
 * aylanib o'tadigan har shakl (`-xu` kabi birlashgan qisqa bayroqlar) ham shu yerda to'xtaydi.
 */
export const assertModeAllowed = (mode: string | null, env: Env) => {
  if (mode !== null && mode !== "none" && env.VISUAL_IN_DOCKER !== "1") throw new Error(UPDATE_REFUSED);
};

/** Konfiguratsiyada erta to'xtatish (testlar boshlanmasidan oldin): CLI argumentlari bo'yicha. */
export const assertUpdateAllowed = (argv: readonly string[], env: Env) => assertModeAllowed(updateModeFromArgv(argv), env);

/**
 * Sahna rasmi bilan nima qilinadi:
 *   - `dry`      — `VISUAL_DRY=1`: solishtirish/yangilash yo'q, rasm `test-results-visual/dry/` ga;
 *   - `neutral`  — baseline hali yo'q va yangilash rejimi emas (PR yugurishi): solishtirilmaydi, test «skipped»,
 *                  `$GITHUB_STEP_SUMMARY` da «baseline yo'q» — job yiqilmaydi;
 *   - `compare`  — `toHaveScreenshot` (baseline bor bo'lsa farq yiqitadi; yangilash rejimida yozadi).
 */
export const snapshotAction = ({
  dry,
  updateSnapshots,
  baselineExists,
}: {
  dry: boolean;
  updateSnapshots: UpdateMode;
  baselineExists: boolean;
}): "dry" | "neutral" | "compare" => {
  if (dry) return "dry";
  if (!baselineExists && updateSnapshots === "none") return "neutral";
  return "compare";
};
