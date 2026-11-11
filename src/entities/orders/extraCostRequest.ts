import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { formatNumberLocalized } from "../../shared/lib/formatMoney";
import type { ExtraCostAction } from "./extraCostApproval";
import type { ExtraCostApprovalStatus } from "./index";

/**
 * QO'SHIMCHA XARAJAT — «ALOHIDA TRANZAKSIYA» rejimi (SPEC v2, ega qarori 2026-11-11).
 *
 * Market tasdig'i yoqilgan bo'lsa ham sotish / qisman sotish / bekor qilish DARHOL bajariladi; faqat qo'shimcha
 * xarajatning o'zi alohida so'rov bo'lib market tasdig'ini kutadi (`mode: "deferred"`). Tasdiqlansa — xarajat alohida
 * yoziladi (keyingi topshirishda hisobga olinadi), rad etilsa — yozilmaydi, buyurtma holati o'zgarmaydi.
 * Eski so'rovlar (`mode: "replay"`, deploydan oldin yaratilgan) — avvalgidek: buyurtma `waiting` da turadi, market
 * tasdiqlasa amal o'zi bajariladi (202 / `approval_required`, `pending_extra_cost_approval`).
 *
 * Backend shartnomasi:
 *  - sotish / qisman sotish / bekor javobi (200/201, hech qachon 202 emas) — `data.extra_cost_request`
 *    `{ id, status: "pending", mode: "deferred", action, amount, items, auto_approve_at, created_at }`;
 *  - buyurtma obyekti (`GET /orders`, kuryer ro'yxati, `GET /orders/:id`, skaner) — `extra_cost_request`: buyurtmaning
 *    oxirgi so'rovi (har holat va rejimda) yoki `null`;
 *  - `GET orders/extra-cost-approvals` va `GET orders/extra-costs` qatorlari — `mode` va `items`.
 *
 * `items` — qaysi tovar uchun xarajat: `[{ order_item_id, product_id, product_name, quantity, sold_quantity?,
 * returned_quantity? }]`. Nomni server o'qishda katalogdan beradi; bo'lmasa — «Tovar #id».
 */

export type ExtraCostMode = "replay" | "deferred";

/** So'rov tovari (normallashtirilgan: id matn, son — son yoki `null`). */
export type ExtraCostItem = {
  order_item_id: string | null;
  product_id: string | null;
  product_name: string | null;
  quantity: number | null;
  /** Qisman sotish: sotilgan soni (xarajat shu tovarlar uchun). */
  sold_quantity?: number | null;
  /** Qisman sotish: qaytgan soni. */
  returned_quantity?: number | null;
};

/** Buyurtmaning qo'shimcha xarajat so'rovi (`extra_cost_request`) — normallashtirilgan. */
export type ExtraCostRequest = {
  id: string;
  status: ExtraCostApprovalStatus;
  /** `null` — server rejimni bermagan (eski javob). */
  mode: ExtraCostMode | null;
  action: ExtraCostAction | null;
  amount: number;
  items: ExtraCostItem[];
  auto_approve_at: string | null;
  created_at: string | null;
  decided_at: string | null;
  reject_reason: string | null;
  reject_reason_label: string | null;
  /** Tasdiqsiz market: xarajat darhol yozilgan. */
  immediate: boolean;
  auto_approved: boolean;
};

type UnknownRecord = Record<string, unknown>;

const STATUSES: readonly ExtraCostApprovalStatus[] = [
  "pending",
  "approved",
  "rejected",
  "void",
  "reversed",
];
const ACTIONS: readonly ExtraCostAction[] = ["sell", "partly_sell", "cancel"];

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : null;

const text = (value: unknown): string | null => {
  if (typeof value === "string") return value.trim() ? value.trim() : null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

const quantityOf = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export const readExtraCostMode = (value: unknown): ExtraCostMode | null =>
  value === "deferred" || value === "replay" ? value : null;

/** So'rov «alohida tranzaksiya» rejimidami (buyurtma allaqachon sotilgan / bekor qilingan). */
export const isDeferredExtraCost = (approval: { mode?: unknown } | null | undefined): boolean =>
  readExtraCostMode(approval?.mode) === "deferred";

/**
 * Hamkor (tashqi) buyurtmasi — `external_id` bor (backend `isPartnerSyncedOrder` bilan bir xil qoida). Bunday
 * buyurtmada backend kechiktirilgan rejimni ishlatmaydi: xarajat yozilsa eski (replay) yo'l — 202
 * `approval_required`, buyurtma `waiting` da qoladi, market tasdiqlasa amal o'zi bajariladi. Oynadagi oldindan
 * ogohlantirish shunga qarab tanlanadi (`ExtraCostNoticeAlert` `replay`).
 */
export const isExtraCostReplayOrder = (order: { external_id?: unknown } | null | undefined): boolean => {
  const value = order?.external_id;
  return (typeof value === "string" || typeof value === "number") && String(value).trim().length > 0;
};

/** Xom `items` → tovarlar ro'yxati (massiv bo'lmasa — bo'sh). */
export const readExtraCostItems = (value: unknown): ExtraCostItem[] =>
  Array.isArray(value)
    ? value
        .map(asRecord)
        .filter((record): record is UnknownRecord => record !== null)
        .map((record) => {
          const product = asRecord(record.product);
          return {
            order_item_id: text(record.order_item_id),
            product_id: text(record.product_id ?? product?.id),
            product_name: text(record.product_name ?? record.name ?? product?.name),
            quantity: quantityOf(record.quantity),
            sold_quantity: quantityOf(record.sold_quantity),
            returned_quantity: quantityOf(record.returned_quantity),
          };
        })
    : [];

/** Buyurtmaning `extra_cost_request` maydoni → so'rov; yo'q yoki noto'g'ri shakl — `null`. */
export const readExtraCostRequest = (value: unknown): ExtraCostRequest | null => {
  const record = asRecord(value);
  const id = record ? text(record.id) : null;
  if (!record || !id) return null;
  const amount = Number(record.amount);
  return {
    id,
    status: STATUSES.find((status) => status === record.status) ?? "pending",
    mode: readExtraCostMode(record.mode),
    action: ACTIONS.find((action) => action === record.action) ?? null,
    amount: Number.isFinite(amount) ? amount : 0,
    items: readExtraCostItems(record.items),
    auto_approve_at: text(record.auto_approve_at),
    created_at: text(record.created_at ?? record.createdAt),
    decided_at: text(record.decided_at),
    reject_reason: text(record.reject_reason),
    reject_reason_label: text(record.reject_reason_label),
    immediate: record.immediate === true,
    auto_approved: record.auto_approved === true,
  };
};

/**
 * Sotish / qisman sotish / bekor javobidagi kechiktirilgan xarajat: `data.extra_cost_request` (`status: "pending"`,
 * `mode: "deferred"`) — amal BAJARILGAN, faqat xarajat market tasdig'ini kutadi. Boshqa holatda `null`.
 */
export const readDeferredExtraCostReply = (response: unknown): ExtraCostRequest | null => {
  const data = asRecord(asRecord(response)?.data);
  const request = readExtraCostRequest(data?.extra_cost_request);
  return request && request.status === "pending" && request.mode === "deferred" ? request : null;
};

/** Tovarning ko'rsatiladigan soni: qisman sotishda — sotilgani (bo'lsa), aks holda buyurtmadagi soni. */
export const extraCostItemQuantity = (
  item: ExtraCostItem,
  action?: ExtraCostAction | null,
): number | null =>
  action === "partly_sell" && item.sold_quantity != null ? item.sold_quantity : item.quantity;

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * «Telefon g'ilofi ×1, Zaryadka ×2» (ko'pi bilan `max` ta, qolgani «+N»). Soni 0 bo'lgan tovar (qisman sotishda
 * sotilmagan) chiqmaydi. Tovar yo'q — `null`. `t` — `orders` nomlar fazosi yuklangan tarjimachi.
 */
export const formatExtraCostItems = (
  items: readonly ExtraCostItem[],
  options: {
    t: Translate;
    language?: string | null;
    action?: ExtraCostAction | null;
    max?: number;
  },
): string | null => {
  const { t, language, action, max = 3 } = options;
  const visible = items.filter((item) => extraCostItemQuantity(item, action) !== 0);
  if (visible.length === 0) return null;
  const parts = visible.slice(0, Math.max(1, max)).map((item) => {
    const name =
      item.product_name ??
      (item.product_id
        ? t("orders:extraCostItems.fallback", { id: item.product_id })
        : t("orders:extraCostItems.unknown"));
    const quantity = extraCostItemQuantity(item, action);
    return quantity === null
      ? name
      : t("orders:extraCostItems.entry", {
          name,
          quantity: formatNumberLocalized(quantity, { language }),
        });
  });
  const rest = visible.length - parts.length;
  const list = parts.join(", ");
  return rest > 0 ? t("orders:extraCostItems.more", { list, rest }) : list;
};

/** `formatExtraCostItems` — komponent ichida (`orders` nomlar fazosi va joriy til bilan). */
export const useFormatExtraCostItems = () => {
  const { t, i18n } = useTranslation("orders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  return useCallback(
    (items: unknown, action?: ExtraCostAction | null, max?: number) =>
      formatExtraCostItems(readExtraCostItems(items), { t, language, action, max }),
    [language, t],
  );
};

export type ExtraCostTagKind = "pending" | "approved" | "rejected";

/**
 * Holat yonidagi belgi: kutilayotgan kechiktirilgan so'rov — «Xarajat kutilmoqda», `showDecided` bo'lsa (tafsilot,
 * skaner) tasdiqlangan / rad etilgani ham. Eski (replay) kutilayotgan so'rovni «Tasdiqqa yuborilgan» belgisi
 * (`ExtraCostApprovalTag`) ko'rsatadi — bu yerda chiqmaydi. `void` / `reversed` — belgisiz.
 * Tasdiqsiz market (`immediate: true`) — backend qatorni `approved` qilib yozadi, lekin market hech narsani
 * tasdiqlamagan: «Xarajat tasdiqlangan» belgisi chiqmaydi (tafsilotdagi qator «Tasdiqsiz yozildi» deydi).
 */
export const extraCostTagKind = (
  request: ExtraCostRequest | null,
  options: { showDecided?: boolean; legacyPending?: boolean } = {},
): ExtraCostTagKind | null => {
  if (!request) return null;
  if (request.status === "pending")
    return request.mode === "replay" || options.legacyPending ? null : "pending";
  if (!options.showDecided) return null;
  if (request.status === "approved") return request.immediate ? null : "approved";
  if (request.status === "rejected") return "rejected";
  return null;
};
