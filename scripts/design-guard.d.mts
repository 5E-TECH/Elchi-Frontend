/**
 * `scripts/design-guard.mjs` tiplari — `src/test/designGuard.test.ts` uni `tsc -b` ostida import qiladi.
 * Dvigatel o'zgarsa, shu faylni ham yangilang.
 */

export type RuleId =
  | "colour"
  | "palette"
  | "dark-pair"
  | "legacy"
  | "money"
  | "icons"
  | "tiny-text"
  | "v1-class"
  | "weight"
  | "gradient"
  | "v1-helper"
  | "named-colour";

export interface GuardRule {
  id: RuleId;
  title: string;
  /** Shu qoida tekshirmaydigan fayllar (masalan, tokenlar manbasi). */
  exempt: string[];
}

export interface Violation {
  rule: RuleId;
  /** 1 dan boshlanadi. */
  line: number;
  col: number;
  match: string;
  /** v2 o'rnini bosuvchisi (masalan, "bg-surface · text-text-muted"). */
  hint: string;
  source: string;
}

export interface IgnoreNote {
  line: number;
  source: string;
}

export interface FileScan {
  file: string;
  /** Birinchi qatorda `// dizayn-v2: <ekran>` — baseline qo'llanmaydi, ruxsat 0. */
  v2: boolean;
  /** Rang qoidalarida (`COLOUR_RULES`) ruxsat 0: `v2` yoki `V2_SCOPES` ichida (`V2_SCOPE_PENDING` emas). */
  scoped: boolean;
  counts: Partial<Record<RuleId, number>>;
  violations: Violation[];
  ignored: number;
  badIgnores: IgnoreNote[];
  unusedIgnores: IgnoreNote[];
}

export interface TreeScan {
  root: string;
  files: FileScan[];
  ms: number;
}

export interface BaselineIncrease {
  date: string;
  reason: string;
  /** fayl → qoida → [eski, yangi]. Boshlang'ich baseline'da yo'q (`initial: true`, `total`). */
  changes?: Record<string, Partial<Record<RuleId, [number, number]>>>;
  initial?: boolean;
  total?: number;
}

export interface Baseline {
  $comment: string;
  version: number;
  rules: Record<RuleId, string>;
  increases: BaselineIncrease[];
  files: Record<string, Partial<Record<RuleId, number>>>;
}

export interface Regression {
  file: string;
  rule: RuleId;
  count: number;
  baseline: number;
  newFile: boolean;
  v2File: boolean;
  /** V2_SCOPES fayli (v2 belgisiz), rang qoidasi — baseline ruxsati 0, `--update` qotirmaydi. */
  scopeFile: boolean;
  violations: Violation[];
}

export interface Comparison {
  regressions: Regression[];
  improvements: Array<{ file: string; rule: RuleId; count: number; baseline: number }>;
  stale: string[];
  totals: Record<RuleId, { current: number; baseline: number }>;
}

export const ROOT: string;
export const BASELINE_FILE: string;
export const IGNORE_MARKER: string;
export const RULES: readonly GuardRule[];
export const RULE_IDS: readonly RuleId[];
/** 1-bosqich o'rnini bosgan v1 modullari (src'ga nisbatan, kengaytmasiz) → v2 o'rnini bosuvchisi (hint). */
export const V1_MODULES: Readonly<Record<string, string>>;
/** Rang qoidalari — V2_SCOPES (ruxsat 0) va OUTPUT_FORMAT_FILES (istisno) faqat shularga qo'llanadi. */
export const COLOUR_RULES: readonly RuleId[];
/** 4-bosqichda to'liq ko'chirilgan papkalar (`src/<qatlam>/<slice>` yoki chuqurroq): ichidagi har fayl rangda 0. */
export const V2_SCOPES: readonly string[];
/** Scope ichida hali v1 qolgan fayllar → sabab. Faqat qisqaradi (`src/test/paletteGuard.test.ts`). */
export const V2_SCOPE_PENDING: Readonly<Record<string, string>>;
/** Chop etish / yorliq / Excel fayllari → sabab. Rang qoidalari qo'llanmaydi. */
export const OUTPUT_FORMAT_FILES: Readonly<Record<string, string>>;
/** CSS nomli ranglari (148 ta; `transparent`, `currentColor`, `inherit`, `none` yo'q). */
export const CSS_NAMED_COLOURS: readonly string[];
export function isInV2Scope(file: string): boolean;

/**
 * Import spetsifikatorini `file` joylashuviga nisbatan src modul yo'liga aylantiradi
 * (`./x`, `../x`, `@/x`, `src/x`, `/src/x`; kengaytma va `/index` tashlanadi). Paket — `null`.
 */
export function resolveImportPath(spec: string, file: string): string | null;

export function maskComments(text: string): string;
export function scanSource(file: string, text: string): FileScan;
export function isGuardedFile(rel: string): boolean;
export function listSourceFiles(root?: string): string[];
export function scanTree(options?: { root?: string }): TreeScan;
export function loadBaseline(root?: string): Baseline | null;
export function compareToBaseline(scan: TreeScan, baseline: Baseline | null): Comparison;
export function buildBaseline(
  scan: TreeScan,
  previous: Baseline | null,
  options?: { allowIncrease?: string; date?: string },
): Baseline;
export function serializeBaseline(baseline: Baseline): string;
export function formatRegressions(cmp: Pick<Comparison, "regressions" | "stale">): string;
export function formatBadIgnores(scan: TreeScan): string;
export interface DiffEntry {
  oldPath: string | null;
  newPath: string | null;
  added: Set<number>;
  removed: Set<number>;
}
export function parseUnifiedDiff(text: string): DiffEntry[];
export function diffViolations(options?: { base?: string; root?: string }): {
  base: string;
  mergeBase: string;
  files: Array<{ file: string; violations: Violation[]; badIgnores: IgnoreNote[] }>;
};
export function main(argv: string[]): number;
