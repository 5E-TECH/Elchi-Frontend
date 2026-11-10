// dizayn-v2: superadmin-payments-main-cashbox-accounts
import { CreditCard, Landmark, Smartphone, type LucideIcon } from "lucide-react";
import type { CashboxCard, CashboxCardKind } from "../../../../entities/payments/cashboxCards";
import { getActionErrorMessage } from "../../../../shared/lib/actionError";
import {
  isIdempotentReplay,
  isUncertainPaymentError,
  settlePaymentKey,
  takePaymentKey,
} from "../lib/paymentIdempotency";

/**
 * KASSA KARTALARI OYNALARINING UMUMIY YORDAMCHILARI (cards1111).
 *
 *  - Turi ikonkasi (maket `superadmin-payments-main-cashbox-accounts`): virtual — `Smartphone`, plastik — `CreditCard`,
 *    bank hisob raqami — `Landmark`; turi yo'q (eski karta) — `CreditCard`.
 *  - Pul ko'chiradigan amallar (o'tkazma, konvertatsiya, qoldiqli o'chirish) `Idempotency-Key` bilan
 *    (`lib/paymentIdempotency`): kalit amalning «barmoq izi»ga bog'lanadi va faqat JAVOB kelganda o'chadi — javobi
 *    yo'qolgan urinish (504, tarmoq) qayta bosilsa o'sha kalit ketadi, backend pulni ikkinchi marta o'tkazmaydi.
 */

export const CARD_KIND_ICON: Record<CashboxCardKind, LucideIcon> = {
  virtual_card: Smartphone,
  plastic_card: CreditCard,
  bank_account: Landmark,
};

export const cardTransferFingerprint = (from: string, to: string, amount: number) =>
  JSON.stringify(["card-transfer", from, to, amount]);

export const cardConvertFingerprint = (type: string, card: string, amount: number) =>
  JSON.stringify(["card-convert", type, card, amount]);

export const cardDeleteFingerprint = (id: string, moveTo: string | null, to: string | null, amount: number) =>
  JSON.stringify(["card-delete", id, moveTo, to, amount]);

/** Faol kartalar (o'tkazma / konvertatsiya / o'chirishdagi manzil): Asosiy birinchi, so'ng `sort_order` bo'yicha. */
export const activeCards = (cards: readonly CashboxCard[]) => cards.filter((card) => card.is_active);

/** Natija noma'lum (javob kelmadi) — oynadagi xato qutisini tanib olish uchun belgi. */
export class UncertainCardMoveError extends Error {
  readonly original: unknown;
  constructor(original: unknown) {
    super("uncertain");
    this.name = "UncertainCardMoveError";
    this.original = original;
  }
}

export const isUncertainCardMoveError = (error: unknown): error is UncertainCardMoveError =>
  error instanceof UncertainCardMoveError;

/**
 * Idempotent yuborish: kalit olinadi → `send(key)` → javob kelsa kalit o'chadi. Natija noma'lum xatoda
 * (`isUncertainPaymentError`) kalit SAQLANADI, ro'yxat qayta o'qiladi va `UncertainCardMoveError` tashlanadi
 * (oyna «Natija noma'lum» deydi; qayta bosish o'sha kalit bilan — xavfsiz). Boshqa xatoda ham kalit qoladi
 * (`mainCashbox` dagi kabi — faqat javob kelganda o'chadi), xato o'zgarmay qaytadi (backend matni oynada).
 */
export const sendIdempotent = async <R extends { data?: unknown }>({
  fingerprint,
  send,
  onUncertain,
}: {
  fingerprint: string;
  send: (idempotencyKey: string) => Promise<R>;
  onUncertain?: () => void;
}): Promise<{ response: R; replay: boolean }> => {
  const key = takePaymentKey(fingerprint);
  try {
    const response = await send(key);
    settlePaymentKey(fingerprint);
    return {
      response,
      replay: isIdempotentReplay(response as { data?: { data?: { idempotent?: boolean } | null } | null }),
    };
  } catch (error) {
    if (isUncertainPaymentError(error)) {
      onUncertain?.();
      throw new UncertainCardMoveError(error);
    }
    throw error;
  }
};

/**
 * Javobi yo'qolgan urinish aslida bajarilgan, lekin backend takrorni `idempotent: true` bilan qaytara olmaydi (qoldiqsiz
 * o'chirish harakat yozmaydi — takror 404 «Karta topilmadi»): shu amalning kalitini qo'lda o'chirish.
 */
export const settleCardMoveKey = (fingerprint: string) => settlePaymentKey(fingerprint);

/** Backend xabari (o'zbekcha, aynan) yoki zaxira matn. */
export const cardErrorMessage = (error: unknown, fallback: string) => getActionErrorMessage(error, fallback) ?? fallback;
