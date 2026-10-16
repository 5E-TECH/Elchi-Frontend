import i18n from "../../../../i18n";
import { getBackendErrorMessage } from "../../../../shared/lib/backendError";
import { notify } from "../../../../shared/lib/notify";
import { getUzbekistanPhoneDigits, toUzbekistanPhoneValue } from "../../../../shared/lib/phone";
import type {
  AddressUpdateValidationError,
  CustomerUpdateValidationError,
  EditableOrderItem,
  EditableOrderSnapshot,
  OrderEditForm,
} from "../newOrderUpdateRules";

/**
 * BUYURTMA TAFSILOTI (`/orders/edit/:orderId`) — TAHRIRLASH OYNALARINING UMUMIY MODELI.
 *
 * Uch oyna (manzil, mijoz, buyurtma/mahsulotlar) bir xil buyurtma obyektini oladi va o'zi saqlaydi:
 * tekshiruv, payload (`newOrderUpdateRules.ts` — o'zgarmagan), so'rov, natija xabari. Sahifa faqat
 * qaysi oyna ochiqligini va tugma ruxsatini (rol, qulf) boshqaradi.
 */

/** Oynadagi mahsulot qatori (katalogsiz — `product: null`, nom `product_name` da). */
export type EditDialogOrderItem = EditableOrderItem & {
  product: { id: string; name?: string | null } | null;
  product_id?: string | null;
  product_name?: string | null;
};

/** Oynalar o'qiydigan buyurtma maydonlari (sahifadagi `GET orders/:id` javobi shunga mos). */
export type EditDialogOrder = EditableOrderSnapshot & {
  id: string | number;
  items: EditDialogOrderItem[];
  customer: { id?: string | null; name: string; phone_number: string };
  district?: {
    id?: string;
    name?: string | null;
    region_id?: string;
    region?: { id?: string; name?: string | null } | null;
  };
  region?: { id?: string; name?: string | null };
};

/** Har oynaning umumiy prop'lari — sahifa shu shaklda chaqiradi. */
export type EditDialogProps = {
  /** Oyna ochiqmi. */
  open: boolean;
  /** Tahrirlanadigan buyurtma; `null` bo'lsa oyna chizilmaydi. */
  order: EditDialogOrder | null;
  /** Yopish so'raldi (Esc, fon, «Yopish», «Bekor qilish» yoki saqlash muvaffaqiyatli tugadi). */
  onClose: () => void;
  /** Saqlandi (so'rov muvaffaqiyatli; o'zgarish bo'lmasa chaqirilmaydi) — `onClose` dan oldin. */
  onSaved?: () => void;
};

// ─── Matn ────────────────────────────────────────────────────────────────────

/** Oyna izohi: «№10241 · Dilnoza Karimova» (ikkinchi qism bo'lmasa — «№10241»). */
export const formatDialogSubtitle = (id: string | number, second?: string | null) => {
  const name = second?.trim();
  return name
    ? i18n.t("orders:orderActionDoneDescription", { id, name })
    : i18n.t("orders:orderNumberShort", { id });
};

/** Buyurtmaning market nomi (`market` obyekti har xil kelishi mumkin — himoyalangan o'qish). */
export const readMarketName = (market: unknown): string | null => {
  if (!market || typeof market !== "object") return null;
  const name = (market as { name?: unknown }).name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
};

// ─── Natija xabari ───────────────────────────────────────────────────────────

/** Saqlandi — sarlavha nima bo'lganini, izoh qaysi buyurtma ekanini aytadi (`tizim-feedback` 01). */
export const notifySaved = (titleKey: string, subtitle: string) => {
  notify.success(i18n.t(titleKey), { description: subtitle });
};

/** Server rad etdi — oyna ochiq qoladi, xabar foydalanuvchi yopguncha turadi (sahifadagi avvalgi xabar). */
export const notifySaveError = (error: unknown) => {
  notify.error(i18n.t("common:error"), {
    description: getBackendErrorMessage(error) ?? i18n.t("newOrders:updateError"),
  });
};

// ─── Manzil ──────────────────────────────────────────────────────────────────

export type AddressFormState = { region_id: string; district_id: string; address: string };

/** Joriy manzil — `buildAddressUpdatePayload` taqqoslaydigan qiymatlar bilan bir xil manbadan. */
export const seedAddressForm = (order: EditDialogOrder): AddressFormState => ({
  region_id: order.district?.region_id ?? order.region?.id ?? order.district?.region?.id ?? "",
  district_id: order.district_id ?? order.district?.id ?? "",
  address: order.address ?? "",
});

export const ADDRESS_ERROR_KEYS: Record<Exclude<AddressUpdateValidationError, null>, string> = {
  region: "orders:validationRegion",
  district: "orders:validationDistrict",
};

// ─── Mijoz ───────────────────────────────────────────────────────────────────

export type CustomerFormState = { name: string; phone: string };

/** Telefon maydoni qiymati `+998…` (`TextInput mode="phone"`). */
export const seedCustomerForm = (order: EditDialogOrder): CustomerFormState => ({
  name: order.customer?.name ?? "",
  phone: toUzbekistanPhoneValue(order.customer?.phone_number ?? ""),
});

/**
 * Bo'sh telefon maydoni `+998` qaytaradi — qoidaga bo'sh satr beriladi, shunda xabar «telefon
 * raqamini kiriting» bo'ladi («9 ta raqam» emas).
 */
export const toCustomerRulesInput = (form: CustomerFormState): CustomerFormState => ({
  name: form.name,
  phone: getUzbekistanPhoneDigits(form.phone) ? form.phone : "",
});

export const CUSTOMER_ERROR_KEYS: Record<Exclude<CustomerUpdateValidationError, null>, string> = {
  name: "orders:validationCustomerName",
  phoneRequired: "orders:validationPhoneRequired",
  phoneFormat: "orders:validationPhoneFormat",
};

// ─── Buyurtma ────────────────────────────────────────────────────────────────

export type OrderFormState = Omit<OrderEditForm, "items"> & { items: EditDialogOrderItem[] };

/**
 * Summa maydoni faqat raqamlar satrini oladi (`TextInput mode="money"`). Backend `total_price` ni
 * `"150000.00"` satri bilan ham qaytaradi — nuqtasini olib tashlab bo'lmaydi (aks holda 15 000 000
 * bo'lib qoladi), shuning uchun avval songa aylantiriladi.
 */
export const toMoneyDigits = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "";
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? String(Math.round(amount)) : "";
};

export const seedOrderForm = (order: EditDialogOrder): OrderFormState => ({
  where_deliver: order.where_deliver ?? "",
  total_price: toMoneyDigits(order.total_price),
  comment: order.comment ?? "",
  items: (order.items ?? []).map((item) => ({ ...item })),
});

/**
 * Qoidaga beriladigan summa: foydalanuvchi summaga tegmagan bo'lsa — buyurtmadagi asl qiymat
 * (kasrli summa yaxlitlanib «o'zgardi» deb yuborilmasin), aks holda maydondagi raqamlar.
 */
export const toRulesTotalPrice = (order: EditDialogOrder, seeded: string, current: string) =>
  current === seeded && order.total_price !== null && order.total_price !== undefined
    ? String(order.total_price)
    : current;
