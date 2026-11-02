import axios from "axios";

/**
 * TUMAN SOATO KODI QOIDASI (backend 2026-11-01, ExK28CiS): `POST district` va `PATCH district/sato/:id` da kod
 * MAJBURIY — aniq 7 raqam, viloyatning SOATO kodi (4 raqam) bilan boshlanadi (viloyatda kod bo'lsa). Prefiks:
 * yangi tumanda — TANLANGAN viloyat, kod tahririda — tumanning GEOGRAFIK viloyati (`region_id`, `assigned_region`
 * emas). Viloyatda kod yo'q bo'lsa backend prefiksni tekshirmaydi — klient ham to'smaydi.
 *
 * Server javoblari: 400 `data.reason` — `sato_code_required` · `sato_code_format` · `region_prefix_mismatch`
 * (`data.details.expected_prefix`); gateway validatsiyasi — 400 sababsiz; 404 — viloyat (POST) yoki tuman (PATCH)
 * topilmadi; 409 sababsiz — nom yoki kod band (`GET district/sato/:code` bilan ajratiladi). Server matni o'qilmaydi.
 */

/** Aniq 7 raqam (bo'sh joylar kesiladi). */
export const isDistrictSatoCode = (value: string): boolean => /^\d{7}$/.test(value.trim());

/**
 * Kod viloyat prefiksi bilan boshlanmasa — kutilgan prefiks, aks holda `null`. Viloyatda kod yo'q bo'lsa
 * (yoki kod hali 7 raqam emas — avval format xatosi) tekshirilmaydi.
 */
export const satoPrefixMismatch = (code: string, regionCode: string | null | undefined): string | null => {
  const prefix = regionCode?.trim() ?? "";
  const value = code.trim();
  if (!prefix || !isDistrictSatoCode(value)) return null;
  return value.startsWith(prefix) ? null : prefix;
};

/** Klient tekshiruvi (so'rovdan oldin): bo'sh · format · prefiks; hammasi joyida — `null`. */
export type DistrictSatoClientError =
  | { kind: "required" }
  | { kind: "format" }
  | { kind: "prefix"; expectedPrefix: string };

export const validateDistrictSatoCode = (
  code: string,
  regionCode: string | null | undefined,
): DistrictSatoClientError | null => {
  const value = code.trim();
  if (!value) return { kind: "required" };
  if (!isDistrictSatoCode(value)) return { kind: "format" };
  const expectedPrefix = satoPrefixMismatch(value, regionCode);
  return expectedPrefix ? { kind: "prefix", expectedPrefix } : null;
};

/** Server xatosi turi (`POST district`, `PATCH district/sato/:id`). */
export type DistrictSatoServerError =
  | { kind: "format" }
  /** `expectedPrefix` — serverdagi `details.expected_prefix` (bo'lmasa `null` — klient o'zi biladigan prefiks). */
  | { kind: "prefix"; expectedPrefix: string | null }
  /** 409: nom yoki kod band — egasi `GET district/sato/:code` bilan aniqlanadi. */
  | { kind: "conflict" }
  /** 404: viloyat (POST) yoki tuman (PATCH) topilmadi. */
  | { kind: "regionMissing" }
  | { kind: "failed" };

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const FORMAT_REASONS = new Set(["sato_code_required", "sato_code_format"]);

export const classifyDistrictSatoError = (error: unknown): DistrictSatoServerError => {
  if (!axios.isAxiosError(error) || !error.response) return { kind: "failed" };
  const { status } = error.response;
  if (status === 409) return { kind: "conflict" };
  if (status === 404) return { kind: "regionMissing" };
  if (status !== 400) return { kind: "failed" };
  const data = asRecord(asRecord(error.response.data).data);
  const reason = typeof data.reason === "string" ? data.reason : "";
  if (reason === "region_prefix_mismatch") {
    const raw = asRecord(data.details).expected_prefix;
    const expectedPrefix = typeof raw === "string" || typeof raw === "number" ? String(raw).trim() : "";
    return { kind: "prefix", expectedPrefix: expectedPrefix || null };
  }
  // Sababsiz 400 — gateway validatsiyasi (`sato_code` bo'sh yoki 7 raqam emas; nom va viloyat klientda tekshirilgan).
  if (!reason || FORMAT_REASONS.has(reason)) return { kind: "format" };
  return { kind: "failed" };
};
