/**
 * `scripts/eslint-design-v2.mjs` tiplari — `src/test/lintRatchet.test.ts` uni `tsc -b` ostida import qiladi.
 * Ma'lumot o'zgarsa (yangi eksport), shu faylni ham yangilang.
 */

export interface RawControlSelector {
  /** ESLint (esquery) selektori. */
  selector: string;
  /** O'zbekcha xabar — nima o'rniga nima ishlatiladi. */
  message: string;
}

export interface UiImportPath {
  name: string;
  allowImportNames?: string[];
  importNames?: string[];
  message: string;
}

export interface UiImportPattern {
  group: string[];
  message: string;
}

export interface UiImportOptions {
  paths: UiImportPath[];
  patterns: UiImportPattern[];
}

export const DS_LAYER: string[];
export const TEST_FILES: string[];
export const RAW_CONTROL_SELECTORS: RawControlSelector[];
export const UI_IMPORT_OPTIONS: UiImportOptions;
/** Fayl → sabab. FAQAT QISQARADI. */
export const RAW_CONTROL_RATCHET: Record<string, string>;
/** Fayl → sabab. FAQAT QISQARADI. */
export const UI_IMPORT_RATCHET: Record<string, string>;
/** Bosqich A: G2/G3 yo'llari (`warn`). Bosqich B da `[]`. */
export const STAGE_A_PENDING: string[];
