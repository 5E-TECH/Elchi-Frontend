import type { Batch, BatchDirection, BatchStatus } from "../../../entities/batch";

/**
 * «PAKETLAR» (`/batches`, `/batches/:id`) va «QAYTARISHLAR» (`/returns`) — sof yordamchilar.
 * Hammasi `batchView.test.ts` da tekshiriladi.
 */

/** `/batches` tablari: `?tab=new|old|return` (sukut `new`). */
export type BatchTabKey = "new" | "old" | "return";

export const BATCH_TAB_KEYS: readonly BatchTabKey[] = ["new", "old", "return"];

/**
 * Tab → `GET transfer-batches` paramlari (v1 dagidek): yangi — `PENDING` + `FORWARD`, eski — `RECEIVED` + `FORWARD`,
 * qaytarilgan — faqat `RETURN` (holat bo'yicha cheklanmaydi).
 */
export const BATCH_TAB_PARAMS: Record<BatchTabKey, { status: BatchStatus | ""; direction: BatchDirection | "" }> = {
  new: { status: "new", direction: "forward" },
  old: { status: "received", direction: "forward" },
  return: { status: "", direction: "return" },
};

export const parseBatchTab = (value: string | null | undefined): BatchTabKey =>
  value === "old" || value === "return" ? value : "new";

/** Paket qaysi tabda turadi (to'g'ridan-to'g'ri ochilgan tafsilotdan «← Paketlar» shu tabga qaytaradi). */
export const batchTabOf = (batch: Pick<Batch, "status" | "direction">): BatchTabKey =>
  batch.direction === "return" ? "return" : batch.status === "received" ? "old" : "new";

/** Normalizator topa olmagan matn «—» bo'lib keladi (`batchApi.ts` `toText` zaxirasi). */
export const knownText = (value: string | null | undefined): string | null => {
  const text = value?.trim();
  return text && text !== "—" ? text : null;
};

/**
 * Filial nomi ro'yxatda yo'q («—») yoki id zaxirasi («Filial #12») — haqiqiy nomni `GET branches` dan qidirish kerak
 * (v1 dagidek).
 */
export const isPlaceholderBranchName = (name: string | null | undefined): boolean =>
  knownText(name) === null || /^Filial #\S+$/i.test(String(name).trim());

/** Paket boradigan viloyat (`to_branch.region`); noma'lum bo'lsa `null`. */
export const readBatchRegion = (batch: Pick<Batch, "to_branch">): string | null => knownText(batch.to_branch.region);

/** Paket tafsilotiga qaysi sahifadan kelingan (orqaga havola shunga qarab). */
export type BatchDetailFrom = "batches" | "returns" | "mails-old";

export type BatchDetailLocationState = { from?: BatchDetailFrom; fromSearch?: string };

const FROM_VALUES: readonly BatchDetailFrom[] = ["batches", "returns", "mails-old"];

/** `location.state` — tashqi ma'lumot: faqat ma'lum maydonlar olinadi. */
export const readBatchDetailState = (state: unknown): BatchDetailLocationState => {
  if (!state || typeof state !== "object") return {};
  const record = state as Record<string, unknown>;
  const from = FROM_VALUES.find((value) => value === record.from);
  const fromSearch = typeof record.fromSearch === "string" ? record.fromSearch : undefined;
  return { ...(from ? { from } : {}), ...(fromSearch ? { fromSearch } : {}) };
};

/** `?tab=old&page=2` yoki `tab=old` → `?tab=old` (bo'sh — `""`). */
const toSearch = (search: string | undefined): string => {
  const value = search?.trim() ?? "";
  if (!value || value === "?") return "";
  return value.startsWith("?") ? value : `?${value}`;
};

export type BatchBack = { to: string; label: "returns" | "mailsOld" | "batches" };

/**
 * «←» havolasi (ega qarori D20): qaytarishlardan — «Qaytarishlar», eski pochtalardan — «Eski pochtalar» (filtrlar
 * bilan), aks holda «Paketlar» — kelgan tab va sahifaga; to'g'ridan-to'g'ri ochilsa paket holatiga mos tabga.
 */
export const resolveBatchBack = (
  state: BatchDetailLocationState,
  batch?: Pick<Batch, "status" | "direction"> | null,
): BatchBack => {
  if (state.from === "returns") return { to: `/returns${toSearch(state.fromSearch)}`, label: "returns" };
  if (state.from === "mails-old") return { to: `/mails/old${toSearch(state.fromSearch)}`, label: "mailsOld" };
  const search = state.from === "batches" ? toSearch(state.fromSearch) : "";
  if (search) return { to: `/batches${search}`, label: "batches" };
  return { to: batch ? `/batches?tab=${batchTabOf(batch)}` : "/batches", label: "batches" };
};

/** Yetkazish turi bo'yicha xulosa («Uygacha» — `center` dan boshqa hammasi, «Markazgacha» — `center`). */
export type DeliveryBreakdown = {
  home: { count: number; sum: number };
  center: { count: number; sum: number };
};

export const summarizeDelivery = (
  orders: readonly { where_deliver?: string | null; total_price?: number | null }[],
): DeliveryBreakdown =>
  orders.reduce<DeliveryBreakdown>(
    (acc, order) => {
      const bucket = order.where_deliver === "center" ? acc.center : acc.home;
      bucket.count += 1;
      bucket.sum += Number(order.total_price) || 0;
      return acc;
    },
    { home: { count: 0, sum: 0 }, center: { count: 0, sum: 0 } },
  );

export const sumOrdersTotal = (orders: readonly { total_price?: number | null }[]): number =>
  orders.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0);

/** Paket tarixi harakati (backend `BranchTransferBatchAction`: `CREATED | SENT | RECEIVED | CANCELLED`). */
export type BatchHistoryKind = "created" | "sent" | "received" | "cancelled";

const HISTORY_KINDS: Record<string, BatchHistoryKind> = {
  created: "created",
  sent: "sent",
  received: "received",
  cancelled: "cancelled",
  canceled: "cancelled",
};

/** Ma'lum harakat bo'lsa uning turi, aks holda `null` (matn o'zicha ko'rsatiladi). */
export const readBatchHistoryKind = (action: string | null | undefined): BatchHistoryKind | null =>
  HISTORY_KINDS[String(action ?? "").trim().toLowerCase()] ?? null;
