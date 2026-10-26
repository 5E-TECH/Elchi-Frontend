/**
 * `scripts/query-key-roots.mjs` tiplari — `src/test/queryKeyRoots.test.ts` uni `tsc -b` ostida import qiladi.
 * Skript o'zgarsa, shu faylni ham yangilang.
 */

/** Endpoint (`GURUH.NOM`) → kesh ildizi → joylar (`fayl:qator`). */
export type QueryKeyRoots = Map<string, Map<string, string[]>>;

export interface QueryKeyScan {
  roots: QueryKeyRoots;
  /** Ildizi aniqlanmagan, endpoint chaqiradigan kalitlar (`fayl:qator`). */
  unresolved: string[];
}

export interface QueryKeyViolation {
  endpoint: string;
  roots: Record<string, string[]>;
  /** Ro'yxatda yo'q ildizlar. */
  extra: string[];
}

export interface QueryKeyCheck {
  violations: QueryKeyViolation[];
  /** Ro'yxatda turgan, lekin endi bitta ildizdagi endpointlar. */
  stale: string[];
}

export declare const SHARED_ROOTS_RATCHET: Record<string, string[]>;
export declare function scanQueryKeyRoots(root?: string): QueryKeyScan;
export declare function checkQueryKeyRoots(
  scan: Pick<QueryKeyScan, "roots">,
  ratchet?: Record<string, string[]>,
): QueryKeyCheck;
export declare function formatReport(check: QueryKeyCheck): string;
