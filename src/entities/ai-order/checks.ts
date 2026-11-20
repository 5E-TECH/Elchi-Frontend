import { AI_BLOCKING_CHECK_CODES, type AiBlockingCheckCode, type AiCheck, type AiDistrictMatch } from "./types";

/**
 * AI TEKSHIRUVLARI (P1-7) — server javobini himoyalangan holda o'qish.
 *
 * Backend ro'yxatni kengaytirishi mumkin («noma'lum `code` e'tiborsiz qoldirilsin»), shuning uchun har element
 * shakli tekshiriladi: noma'lum kod yoki buzuq maydon — tashlab yuboriladi, karta yiqilmaydi.
 */

const isIndex = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;

const toAmounts = (value: unknown): number[] =>
  Array.isArray(value) ? value.filter((amount): amount is number => typeof amount === "number" && Number.isFinite(amount)) : [];

const toCheck = (raw: unknown): AiCheck | null => {
  if (!raw || typeof raw !== "object") return null;
  const check = raw as Record<string, unknown>;
  switch (check.code) {
    case "district_low_confidence":
    case "phone_is_market":
      return { code: check.code };
    case "price_check":
      return {
        code: "price_check",
        kind: check.kind === "too_high" ? "too_high" : "mismatch",
        mentions: toAmounts(check.mentions),
      };
    case "qty_check":
      return isIndex(check.item_index) ? { code: "qty_check", item_index: check.item_index } : null;
    case "duplicate_items": {
      const indexes = Array.isArray(check.item_indexes) ? check.item_indexes.filter(isIndex) : [];
      return indexes.length >= 2 ? { code: "duplicate_items", item_indexes: indexes } : null;
    }
    case "same_phone_multi":
      return isIndex(check.other_index) ? { code: "same_phone_multi", other_index: check.other_index } : null;
    default:
      return null;
  }
};

/** Server `checks[]` → faqat tanish va to'g'ri shakldagi tekshiruvlar (eski backend: `[]`). */
export const normalizeAiChecks = (raw: unknown): AiCheck[] =>
  Array.isArray(raw) ? raw.map(toCheck).filter((check): check is AiCheck => check !== null) : [];

export const isBlockingCheckCode = (code: unknown): code is AiBlockingCheckCode =>
  (AI_BLOCKING_CHECK_CODES as readonly unknown[]).includes(code);

/** `district_match` — `ai_text` bo'sh bo'lsa ko'rsatadigan narsa yo'q. */
export const normalizeDistrictMatch = (raw: unknown): AiDistrictMatch | null => {
  if (!raw || typeof raw !== "object") return null;
  const match = raw as Record<string, unknown>;
  const aiText = typeof match.ai_text === "string" ? match.ai_text.trim() : "";
  if (!aiText) return null;
  return {
    method: typeof match.method === "string" ? match.method : "",
    ai_text: aiText,
    score: typeof match.score === "number" && Number.isFinite(match.score) ? match.score : null,
  };
};
