import type { AiAccessList, AiAccessUpdate } from "../../../entities/ai-advisor";

/**
 * «KIRISH HUQUQI» OYNASI FORMASI (F7PWp6cK, ega 2026-11-23) — sof funksiyalar (`AccessDialog.tsx`).
 *
 * Qator — bitta admin: kalit (`enabled`) va kunlik limit matni. Bo'sh limit — sukut (`daily_limit: null`). Backend
 * chegarasi: butun son 0..10 000 (`AiAssistantAccessUpdateDto`). Saqlash — faqat o'zgargan qatorlar, har biri alohida
 * `PATCH ai/assistant/access`.
 */

/** Backend `@Max(10000)`. */
export const AI_ACCESS_LIMIT_MAX = 10_000;

export type AccessAdmin = { id: string; name: string; phone: string };

export type AccessRow = {
  userId: string;
  name: string;
  phone: string;
  enabled: boolean;
  /** Maydondagi matn: bo'sh — sukut. */
  limit: string;
};

export type AccessLimitError = "invalid";

export type ParsedLimit = { ok: true; value: number | null } | { ok: false; error: AccessLimitError };

/** Bo'sh — `null` (sukut); faqat raqamlar (bo'shliqlar olinadi), 0..10 000. */
export const parseAccessLimit = (text: string): ParsedLimit => {
  const trimmed = text.replace(/\s/g, "");
  if (!trimmed) return { ok: true, value: null };
  if (!/^\d+$/.test(trimmed)) return { ok: false, error: "invalid" };
  const value = Number(trimmed);
  return value <= AI_ACCESS_LIMIT_MAX ? { ok: true, value } : { ok: false, error: "invalid" };
};

const limitText = (value: number | null) => (value === null ? "" : String(value));

/** Adminlar (ism bo'yicha) + server ruxsatlari → forma qatorlari. Ruxsat yozuvi yo'q admin — o'chiq, sukut limit. */
export const buildAccessRows = (admins: AccessAdmin[], list: AiAccessList): AccessRow[] => {
  const grants = new Map(list.items.map((item) => [item.userId, item]));
  return [...admins]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((admin) => {
      const grant = grants.get(admin.id);
      return {
        userId: admin.id,
        name: admin.name,
        phone: admin.phone,
        enabled: grant?.enabled ?? false,
        limit: limitText(grant?.dailyLimit ?? null),
      };
    });
};

/** Faqat yoqilgan qatorlar tekshiriladi (o'chiq qatorda limit maydoni ko'rinmaydi). */
export const validateAccessRows = (rows: AccessRow[]): Record<string, AccessLimitError> => {
  const errors: Record<string, AccessLimitError> = {};
  for (const row of rows) {
    if (!row.enabled) continue;
    const parsed = parseAccessLimit(row.limit);
    if (!parsed.ok) errors[row.userId] = parsed.error;
  }
  return errors;
};

/**
 * O'zgargan qatorlar → `PATCH` tanalari. Kalit o'zgarsa yoki yoqilgan qatorda limit o'zgarsa. O'chirilgan qatorda
 * limit saqlangan qiymatida yuboriladi (yashirin maydondagi tahrir ruxsatni olib qo'yishda yo'qolmaydi va limitni
 * sukutga tushirmaydi).
 */
export const diffAccessRows = (base: AccessRow[], rows: AccessRow[]): AiAccessUpdate[] => {
  const before = new Map(base.map((row) => [row.userId, row]));
  const updates: AiAccessUpdate[] = [];
  for (const row of rows) {
    const prev = before.get(row.userId);
    if (!prev) continue;
    const prevLimit = parseAccessLimit(prev.limit);
    const savedLimit = prevLimit.ok ? prevLimit.value : null;
    if (!row.enabled) {
      if (prev.enabled) updates.push({ userId: row.userId, enabled: false, dailyLimit: savedLimit });
      continue;
    }
    const parsed = parseAccessLimit(row.limit);
    if (!parsed.ok) continue;
    if (!prev.enabled || parsed.value !== savedLimit) {
      updates.push({ userId: row.userId, enabled: true, dailyLimit: parsed.value });
    }
  }
  return updates;
};

/** Saqlangan qatorni yangi asos qilish (qisman saqlashda keyingi urinish faqat qolganlarini yuboradi). */
export const applyAccessUpdate = (base: AccessRow[], update: AiAccessUpdate): AccessRow[] =>
  base.map((row) =>
    row.userId === update.userId ? { ...row, enabled: update.enabled, limit: limitText(update.dailyLimit) } : row,
  );
