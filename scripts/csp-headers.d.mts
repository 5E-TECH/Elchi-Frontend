/**
 * `scripts/csp-headers.mjs` tiplari — `vite.config.ts` va `src/test/securityHeaders.test.ts` uni `tsc -b` ostida
 * import qiladi. Funksiya o'zgarsa, shu faylni ham yangilang.
 */

export declare const INLINE_SCRIPT_HASHES_PLACEHOLDER: "{{INLINE_SCRIPT_HASHES}}";

/** `<script>` (src siz, bajariladigan) matnlarining `'sha256-…'` manbalari. */
export declare const inlineScriptHashes: (html: string) => string[];

/** `_headers` shablonidagi joy tutuvchini xeshlar bilan almashtiradi. */
export declare const fillInlineScriptHashes: (headers: string, hashes: string[]) => string;
