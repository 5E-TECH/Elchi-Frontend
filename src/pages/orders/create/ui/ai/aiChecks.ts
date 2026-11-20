import {
  AI_BLOCKING_CHECK_CODES,
  toLocalPhone,
  toQuantity,
  type AiBlockingCheckCode,
  type AiPreviewOrder,
} from "../../../../../entities/ai-order";
import type { AiDraftOrder } from "./evalPreview";

/**
 * AI TEKSHIRUVLARI KARTADA (P1-7 + AI ack, backend #649/#658; maket `*-create-ai-preview-checks`).
 *
 * Bloklovchi (`district_low_confidence`, `price_check`) — operator ko'rib «… to'g'ri, tasdiqlayman» belgilamaguncha
 * karta «Tasdiq kutmoqda» va yuborilmaydi. Backend qoidasi bilan AYNI istisno: operator tegishli maydonni O'ZI
 * o'zgartirgan bo'lsa (tuman — `district_id`, summa — `total_price`) tasdiq shart emas; viloyat/manzil tahriri tuman
 * tekshiruvini olib tashlamaydi. Solishtirish AI'ning asl chiqishi (`source`) bilan — server ham preview snapshot'i
 * bilan solishtiradi.
 *
 * Yumshoq (`qty_check`, `duplicate_items`, `phone_is_market`, `same_phone_multi`) — faqat eslatma, tasdiq so'ralmaydi;
 * operator tegishli qiymatni o'zgartirsa yoki qatorni olib tashlasa — yo'qoladi.
 */

const sameId = (a: unknown, b: unknown) => String(a ?? "") === String(b ?? "");

const isEmpty = (value: unknown) => value === null || value === undefined;

const samePrice = (a: number | null | undefined, b: number | null | undefined) =>
  isEmpty(a) || isEmpty(b) ? isEmpty(a) && isEmpty(b) : Number(a) === Number(b);

/** Hozir tasdiq talab qiladigan bloklovchi kodlar (doimiy tartibda). */
export const requiredAcks = (order: AiDraftOrder, source: AiPreviewOrder): AiBlockingCheckCode[] => {
  const codes = new Set<AiBlockingCheckCode>(order.server_required_acks ?? []);
  for (const check of order.checks ?? []) {
    if (check.code === "district_low_confidence" && sameId(order.district_id, source.district_id)) codes.add(check.code);
    if (check.code === "price_check" && samePrice(order.total_price, source.total_price)) codes.add(check.code);
  }
  return AI_BLOCKING_CHECK_CODES.filter((code) => codes.has(code));
};

/** Talab qilinadi, lekin operator hali belgilamagan. */
export const pendingAcks = (order: AiDraftOrder, source: AiPreviewOrder): AiBlockingCheckCode[] =>
  requiredAcks(order, source).filter((code) => !order.acked_checks?.includes(code));

/** Serverga `ack_checks`: faqat hozir talab qilinadigan VA operator belgilaganlari (ko'rsatilmaganini emas). */
export const ackChecksToSend = (order: AiDraftOrder, source: AiPreviewOrder): AiBlockingCheckCode[] =>
  requiredAcks(order, source).filter((code) => order.acked_checks?.includes(code));

/** Belgilash / olib tashlash (karta checkbox'i). */
export const withAck = (order: AiDraftOrder, code: AiBlockingCheckCode, checked: boolean): AiBlockingCheckCode[] => {
  const rest = (order.acked_checks ?? []).filter((item) => item !== code);
  return checked ? [...rest, code] : rest;
};

/** Narx tekshiruvi (ko'rinish uchun): turi va matndagi summalar. */
export const priceCheckOf = (order: AiDraftOrder) => {
  const check = order.checks?.find((item) => item.code === "price_check");
  return check?.code === "price_check" ? check : null;
};

export type AiSoftNotes = {
  /** Kartadagi qator o'rni (0..) → AI o'qigan katta son (o'zgartirilmagan bo'lsa). */
  qtyByItem: Map<number, number>;
  /** Bir xil mahsulot qatorlari — kartadagi tartib raqamlari (1..), har guruhda ≥ 2 ta. */
  duplicateGroups: number[][];
  /** Mijoz telefoni — marketning o'z raqami (telefon o'zgartirilmagan). */
  phoneIsMarket: boolean;
  /** Shu telefon boshqa kartada ham — o'sha buyurtmaning preview `index` i (panel kartaga bog'laydi). */
  samePhoneIndex: number | null;
};

export const softNotes = (order: AiDraftOrder, source: AiPreviewOrder): AiSoftNotes => {
  const notes: AiSoftNotes = { qtyByItem: new Map(), duplicateGroups: [], phoneIsMarket: false, samePhoneIndex: null };
  const positionOf = (sourceIndex: number) =>
    order.items.findIndex((item) => !item.added_manually && item.source_index === sourceIndex);
  const phoneUnchanged = order.phone_number === toLocalPhone(source.phone_number);

  for (const check of order.checks ?? []) {
    if (check.code === "qty_check") {
      const position = positionOf(check.item_index);
      const original = source.items?.[check.item_index];
      const item = order.items[position];
      if (item && original && item.quantity === toQuantity(original.quantity)) notes.qtyByItem.set(position, item.quantity);
    } else if (check.code === "duplicate_items") {
      const positions = check.item_indexes
        .map(positionOf)
        .filter((position) => position >= 0)
        .sort((a, b) => a - b);
      if (positions.length >= 2) notes.duplicateGroups.push(positions.map((position) => position + 1));
    } else if (check.code === "phone_is_market") {
      notes.phoneIsMarket = phoneUnchanged;
    } else if (check.code === "same_phone_multi" && phoneUnchanged) {
      notes.samePhoneIndex = check.other_index;
    }
  }
  return notes;
};
