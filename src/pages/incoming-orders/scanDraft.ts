import type { IncomingOrder } from "../../entities/incoming-orders";
import { normalizeScanKey } from "../../shared/lib/scanToken";
import { indexByToken, parcelToken } from "./lib";

/**
 * SKAN QORALAMASI (eo3eeJxs): skanerlangan, lekin hali qabul qilinmagan posilkalar qurilmada (`localStorage`)
 * turadi — F5, sahifadan chiqib qaytish yoki planshet o'chib yonishida operator yarim qopni qaytadan skanerlamaydi.
 *
 *   - Kalit foydalanuvchi va manbaga bog'langan: umumiy qurilmada boshqa xodim oldingisining skanlarini ko'rmaydi,
 *     boshqa manbaga ular o'tmaydi.
 *   - Faqat tokenlar saqlanadi. Tiklashda ular yangi ro'yxat bilan kesishtiriladi: qabul qilib bo'lingan yoki
 *     boshqa joyda olingan posilka qaytmaydi.
 *   - Muddat — smena. Skan posilka qo'lda turganining dalili; kecha skanerlangan posilka bugun ham shu yerda
 *     turibdi degani emas, uni jimgina «skanerlangan» deb ko'rsatib bo'lmaydi.
 *   - `localStorage` yopiq yoki to'la bo'lishi mumkin — har o'qish va yozish `try/catch` ichida; qoralama
 *     bo'lmasa skaner baribir ishlaydi.
 */
const STORAGE_PREFIX = "elchi:incoming-scan:v1:";
export const SCAN_DRAFT_TTL_MS = 12 * 60 * 60 * 1000;

export type ScanDraft = {
  /** Posilka tokenlari — skanerlash tartibida. */
  tokens: readonly string[];
  /** Ulardan qop skani belgilaganlari (qabul xabari «Qop bo'yicha qabul qilindi»). */
  bagTokens: readonly string[];
  /** Oxirgi o'zgarish vaqti (ms). */
  at: number;
};

const storageKey = (userId: string, marketId: string) => `${STORAGE_PREFIX}${userId}:${marketId}`;

const isTextList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isDraft = (value: unknown): value is ScanDraft => {
  if (typeof value !== "object" || value === null) return false;
  const draft = value as Partial<ScanDraft>;
  return isTextList(draft.tokens) && isTextList(draft.bagTokens) && typeof draft.at === "number";
};

export const readScanDraft = (userId: string, marketId: string, now: number = Date.now()): ScanDraft | null => {
  try {
    const raw = window.localStorage.getItem(storageKey(userId, marketId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDraft(parsed) && now - parsed.at <= SCAN_DRAFT_TTL_MS ? parsed : null;
  } catch {
    return null;
  }
};

/** Ro'yxat bo'sh bo'lsa qoralama o'chiriladi (qabul qilindi yoki hammasi olib tashlandi). */
export const writeScanDraft = (
  userId: string,
  marketId: string,
  tokens: readonly string[],
  bagTokens: readonly string[],
  now: number = Date.now(),
) => {
  try {
    const key = storageKey(userId, marketId);
    if (tokens.length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify({ tokens, bagTokens, at: now } satisfies ScanDraft));
  } catch {
    // Saqlab bo'lmadi: skan ekranda turibdi, faqat F5 dan keyin tiklanmaydi.
  }
};

/** Qoralama → ekran holati: faqat ro'yxatda hali bor posilkalar, token ham ro'yxatdagi asl yozuvi bilan. */
export const applyScanDraft = (orders: readonly IncomingOrder[], draft: ScanDraft) => {
  const byToken = indexByToken(orders);
  const ids = new Set<string>();
  const tokens: string[] = [];
  for (const saved of draft.tokens) {
    const order = byToken.get(normalizeScanKey(saved));
    if (!order || ids.has(order.id)) continue;
    ids.add(order.id);
    tokens.push(parcelToken(order));
  }
  const present = new Set(tokens);
  return { ids, tokens, bagTokens: new Set(draft.bagTokens.filter((token) => present.has(token))) };
};
