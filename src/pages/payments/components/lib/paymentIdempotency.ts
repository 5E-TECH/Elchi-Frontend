/**
 * PUL O'TKAZMALARINING IDEMPOTENTLIK KALITLARI (kuryerdan qabul qilish,
 * marketga to'lov, filial → HQ). `payment_date` har submit'da yangi bo'lgani
 * uchun gateway'ning zaxira dedup'i qayta yuborishni har doim ham ushlamaydi —
 * `Idempotency-Key` bilan finance-service pulni faqat bir marta o'tkazadi va
 * takroriy so'rovga `{ statusCode: 200, data: { idempotent: true } }` qaytaradi.
 *
 * Kalit to'lovning "barmoq izi"ga bog'lanadi. Aynan shu to'lov qayta yuborilsa
 * (javobi kelmay qolgan urinish — masalan 504) o'sha kalit ketadi. Biror maydon
 * o'zgarsa — bu BOSHQA to'lov, yangi kalit: eski kalit bilan backend yangi
 * summani o'tkazmay "allaqachon qabul qilingan" deb qaytarardi. `payment_date`
 * va izoh kirmaydi (to'lovning o'zini o'zgartirmaydi).
 *
 * ⚠️ Bitta "joy" yetmaydi. To'lov A ning javobi yo'qolsa (server esa pulni
 * o'tkazgan), keyin B yuborilsa va u ham xato bersa, so'ng A qayta yuborilsa —
 * A yangi kalit olib, pul IKKINCHI marta o'tardi. Shuning uchun har bir to'lov
 * o'z kalitini alohida saqlaydi va kalit faqat AYNAN shu to'lovga javob
 * kelganda o'chiriladi. `sessionStorage` — sahifa qayta ochilsa (F5, orqaga
 * qaytish) ham kalit yo'qolmaydi. Saqlash imkoni bo'lmasa (xususiy rejim)
 * xotirada ishlaydi.
 */

/**
 * Saqlash kaliti nomi o'zgarmaydi (avval faqat kuryer to'lovlari uchun edi):
 * yangi versiya chiqqanda javobsiz qolgan kuryer to'lovining kaliti yo'qolmasin.
 * Barmoq izlari to'qnashmaydi — kuryer izi ID bilan, market/filial izi
 * "market"/"branch" so'zi bilan boshlanadi.
 */
const PENDING_PAYMENT_KEYS = "elchi:pending-courier-payment-keys";
const MAX_PENDING_PAYMENT_KEYS = 50;
let pendingPaymentKeysFallback: Record<string, string> = {};

/**
 * `crypto.randomUUID` faqat xavfsiz kontekstda (https/localhost) bor —
 * aks holda sahifa yiqilmasin.
 */
const newIdempotencyKey = () =>
  typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

const readPendingPaymentKeys = (): Record<string, string> => {
  try {
    const raw = globalThis.sessionStorage?.getItem(PENDING_PAYMENT_KEYS);
    if (!raw) return { ...pendingPaymentKeysFallback };
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? { ...(parsed as Record<string, string>) } : {};
  } catch {
    return { ...pendingPaymentKeysFallback };
  }
};

const writePendingPaymentKeys = (keys: Record<string, string>) => {
  // Eng eskilaridan boshlab kesiladi — cheksiz o'smasin.
  const entries = Object.entries(keys).slice(-MAX_PENDING_PAYMENT_KEYS);
  const bounded = Object.fromEntries(entries);
  pendingPaymentKeysFallback = bounded;
  try {
    globalThis.sessionStorage?.setItem(PENDING_PAYMENT_KEYS, JSON.stringify(bounded));
  } catch {
    // Saqlab bo'lmadi — xotiradagi nusxa ishlatiladi.
  }
};

/** Shu to'lovning kaliti: avval yuborilgan (javobsiz) bo'lsa o'shani qaytaradi. */
export const takePaymentKey = (fingerprint: string): string => {
  const keys = readPendingPaymentKeys();
  const existing = keys[fingerprint];
  if (existing) return existing;
  const key = newIdempotencyKey();
  keys[fingerprint] = key;
  writePendingPaymentKeys(keys);
  return key;
};

/** Shu to'lovga javob keldi (muvaffaqiyat yoki takroriy) — faqat UNING kaliti o'chadi. */
export const settlePaymentKey = (fingerprint: string) => {
  const keys = readPendingPaymentKeys();
  if (!(fingerprint in keys)) return;
  delete keys[fingerprint];
  writePendingPaymentKeys(keys);
};

export type CourierPaymentIdentity = {
  courier_id: string;
  amount: number;
  payment_method: string;
  market_id: string | null;
};

/** Kuryer to'lovi: kuryer + summa + usul + market (o'zgarmagan format). */
export const courierPaymentFingerprint = (payment: CourierPaymentIdentity) =>
  JSON.stringify([payment.courier_id, payment.amount, payment.payment_method, payment.market_id]);

/** Marketga to'lov (HQ → market): market + summa + usul. */
export const marketPaymentFingerprint = (payment: {
  market_id: string;
  amount: number;
  payment_method: string;
}) => JSON.stringify(["market", payment.market_id, payment.amount, payment.payment_method]);

/** Filial → HQ topshirish: filial + summa + usul. */
export const branchToMainPaymentFingerprint = (payment: {
  branch_id: string;
  amount: number;
  payment_method: string;
}) => JSON.stringify(["branch", payment.branch_id, payment.amount, payment.payment_method]);

/**
 * Takroriy `Idempotency-Key`: pul avvalgi (javobi yo'qolgan) urinishda
 * allaqachon o'tgan — finance-service `data.idempotent: true` qaytaradi va
 * pulni ikkinchi marta o'tkazmaydi (yangi to'lov emas).
 */
export const isIdempotentReplay = (
  response: { data?: { data?: { idempotent?: boolean } | null } | null } | null | undefined,
) => response?.data?.data?.idempotent === true;

/**
 * Natijasi noma'lum xato: javob umuman kelmadi (tarmoq, brauzer timeout'i)
 * yoki gateway/proxy javobni kutib tura olmadi (502/503/504). Bunday paytda
 * server pulni o'tkazgan bo'lishi MUMKIN — kassa qayta o'qiladi va
 * foydalanuvchi ogohlantiriladi (ko'r-ko'rona qayta bosmasin).
 */
export const isUncertainPaymentError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const response = (error as { response?: { status?: unknown } }).response;
  if (!response) return true;
  const status = Number(response.status);
  return status === 502 || status === 503 || status === 504;
};
