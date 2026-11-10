import { useCallback } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS } from "../../shared/api";
import { api } from "../../shared/api/api";
import { downloadXlsx } from "../../shared/lib/exportFile";
import { refreshCashboxQueries } from "./index";
import { shiftCheckSettingsKey } from "./shiftAccountCheck";

/**
 * KASSA KARTALARINI BOSHQARISH (cards1111; backend Zv3MLn0a `finance/cashbox/cards…`, `docs/frontend/openapi.json`).
 *
 *  - `GET finance/cashbox/cards?include_inactive` — kartalar (Asosiy karta birinchi, uning qoldig'i HISOBLANGAN:
 *    `balance_card − Σ nomli`), `balance_card`, `total_card`, `in_sync` (Asosiy karta qoldig'i ≥ 0). Kassa doirasi
 *    JWT'dan: superadmin/admin — asosiy kassa, menejer — o'z filiali (faqat o'qiydi).
 *  - Yozish (`@Roles(SUPERADMIN, ADMIN)`): `POST` yaratish (yangi karta 0 qoldiq bilan), `PATCH :id`, `POST :id/make-default`
 *    (pul ko'chmaydi), `PATCH :id/status {is_active}`, `POST transfer` / `POST convert` va `POST :id/delete`
 *    (`{move_to?, to_card_id?, comment?}` — qoldiq bo'lsa avval o'tkaziladi, keyin karta yumshoq o'chiriladi). Pul
 *    ko'chiradiganlari `Idempotency-Key` sarlavhasini oladi (takror — `data.idempotent: true`, 200).
 *  - `GET :id/ledger` (ko'chirma: `items`, `summary`, `pagination`) va `GET :id/ledger/export` (xlsx).
 *
 * Kesh: hamma kalit `["cashbox", "cards", …]` ildizida (`queryKeyRoots` — bitta endpoint bitta ildiz). Har yozishdan
 * keyin `refreshCashboxQueries` (`[cashbox]` — kartalar, kassa, tarix) + smena sozlamalari (karta ro'yxati u yerda
 * ham bor). Realtime `finance.cashbox.card_changed` ham `[cashbox]` ni yangilaydi (`app/providers/realtimeFinance`).
 *
 * `index.ts` dan qayta eksport QILINMAYDI: bu modul `refreshCashboxQueries` ni `./index` dan oladi (aylana import
 * bo'lmasin) — `financeCoverage.ts` kabi to'g'ridan-to'g'ri import qilinadi.
 */

const cashboxKey = "cashbox";

export const CASHBOX_CARD_KINDS = ["virtual_card", "plastic_card", "bank_account"] as const;
export type CashboxCardKind = (typeof CASHBOX_CARD_KINDS)[number];

export type CashboxCard = {
  id: string;
  name: string;
  /** Asosiy kartada — hisoblangan qoldiq (manfiy bo'lishi mumkin: `in_sync=false`). */
  balance: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  kind: CashboxCardKind | null;
  bank_name: string | null;
  card_network: string | null;
  last4: string | null;
  holder_name: string | null;
  note: string | null;
  require_photo_on_shift_close: boolean;
  ai_check_enabled: boolean;
  created_at: string | null;
};

export type CashboxCardList = {
  cashbox_type: "main" | "branch" | null;
  cards: CashboxCard[];
  /** Kassadagi karta qoldig'i (`cashbox.balance_card`). */
  balance_card: number;
  /** Kartalar yig'indisi (nomli + Asosiy) — doim `balance_card` ga teng. */
  total_card: number;
  default_balance: number;
  /** `false` — Asosiy karta qoldig'i manfiy (moslik buzilgan). */
  in_sync: boolean;
};

export const CASHBOX_CARD_LEDGER_KINDS = [
  "income",
  "expense",
  "transfer_in",
  "transfer_out",
  "cash_to_card",
  "card_to_cash",
] as const;
export type CashboxCardLedgerKind = (typeof CASHBOX_CARD_LEDGER_KINDS)[number];

export type CashboxCardLedgerRow = {
  /** `source:id` — tarix va ichki harakat ID lari kesishishi mumkin. */
  key: string;
  kind: CashboxCardLedgerKind;
  created_at: string | null;
  amount: number;
  /** Ishorali: kirim `+`, chiqim `−`. */
  delta: number;
  balance_after: number | null;
  comment: string | null;
  counterparty_card_id: string | null;
};

export type CashboxCardLedgerSummary = {
  opening_balance: number;
  closing_balance: number;
  total_in: number;
  total_out: number;
  current_balance: number;
};

export type CashboxCardLedger = {
  items: CashboxCardLedgerRow[];
  summary: CashboxCardLedgerSummary;
  total: number;
};

/** Ko'chirma filtri: `from` / `to` — `YYYY-MM-DD` (Toshkent kuni) yoki `""`. */
export type CashboxCardLedgerParams = { from: string; to: string; page: number; limit: number };

// ───────────────────────── normalizatorlar ─────────────────────────

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const text = (value: unknown): string | null => {
  if (typeof value === "string") return value.trim() ? value.trim() : null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

const bool = (value: unknown): boolean => value === true || value === "true";

/** `response.data.data` yoki `response.data`. */
const payload = (value: unknown): Record<string, unknown> => {
  const root = record(value);
  return "data" in root && root.data && typeof root.data === "object" ? record(root.data) : root;
};

const toKind = (value: unknown): CashboxCardKind | null =>
  (CASHBOX_CARD_KINDS as readonly unknown[]).includes(value) ? (value as CashboxCardKind) : null;

export const normalizeCashboxCard = (value: unknown): CashboxCard | null => {
  const card = record(value);
  const id = text(card.id);
  if (!id) return null;
  return {
    id,
    name: text(card.name) ?? `#${id}`,
    balance: num(card.balance) ?? 0,
    is_default: bool(card.is_default),
    // Javobda yo'q bo'lsa — faol (ro'yxat sukut bo'yicha faqat faollarni beradi).
    is_active: card.is_active === undefined ? true : bool(card.is_active),
    sort_order: num(card.sort_order) ?? 0,
    kind: toKind(card.kind),
    bank_name: text(card.bank_name),
    card_network: text(card.card_network),
    last4: text(card.last4),
    holder_name: text(card.holder_name),
    note: text(card.note),
    require_photo_on_shift_close: bool(card.require_photo_on_shift_close),
    ai_check_enabled: bool(card.ai_check_enabled),
    created_at: text(card.created_at),
  };
};

export const normalizeCashboxCardList = (value: unknown): CashboxCardList => {
  const data = payload(value);
  const cards = (Array.isArray(data.cards) ? data.cards : [])
    .map(normalizeCashboxCard)
    .filter((card): card is CashboxCard => card !== null);
  const balanceCard = num(data.balance_card) ?? 0;
  const defaultBalance = num(data.default_balance) ?? cards.find((card) => card.is_default)?.balance ?? 0;
  return {
    cashbox_type: data.cashbox_type === "main" || data.cashbox_type === "branch" ? data.cashbox_type : null,
    cards,
    balance_card: balanceCard,
    total_card: num(data.total_card) ?? cards.reduce((sum, card) => sum + card.balance, 0),
    default_balance: defaultBalance,
    in_sync: typeof data.in_sync === "boolean" ? data.in_sync : defaultBalance >= 0,
  };
};

const toLedgerKind = (value: unknown): CashboxCardLedgerKind | null =>
  (CASHBOX_CARD_LEDGER_KINDS as readonly unknown[]).includes(value) ? (value as CashboxCardLedgerKind) : null;

export const normalizeCashboxCardLedger = (value: unknown): CashboxCardLedger => {
  const data = payload(value);
  const summary = record(data.summary);
  const pagination = record(data.pagination);
  const items = (Array.isArray(data.items) ? data.items : [])
    .map((item, index): CashboxCardLedgerRow | null => {
      const row = record(item);
      const kind = toLedgerKind(row.kind);
      if (!kind) return null;
      const amount = Math.abs(num(row.amount) ?? 0);
      const delta = num(row.delta) ?? (kind === "expense" || kind === "transfer_out" || kind === "card_to_cash" ? -amount : amount);
      return {
        key: `${text(row.source) ?? "row"}:${text(row.id) ?? index}`,
        kind,
        created_at: text(row.created_at),
        amount,
        delta,
        balance_after: num(row.balance_after),
        comment: text(row.comment),
        counterparty_card_id: text(row.counterparty_card_id),
      };
    })
    .filter((row): row is CashboxCardLedgerRow => row !== null);
  return {
    items,
    summary: {
      opening_balance: num(summary.opening_balance) ?? 0,
      closing_balance: num(summary.closing_balance) ?? 0,
      total_in: num(summary.total_in) ?? 0,
      total_out: num(summary.total_out) ?? 0,
      current_balance: num(summary.current_balance) ?? 0,
    },
    total: num(pagination.total) ?? items.length,
  };
};

/**
 * Ko'chirma sanalari: backend `new Date(from_date)` va `created_at <= to_date` — kun Toshkent vaqti bilan to'liq
 * olinadi (`to` kunining oxirigacha).
 */
export const cashboxCardLedgerQuery = ({ from, to }: Pick<CashboxCardLedgerParams, "from" | "to">) => ({
  ...(from ? { from_date: `${from}T00:00:00+05:00` } : {}),
  ...(to ? { to_date: `${to}T23:59:59.999+05:00` } : {}),
});

// ───────────────────────── so'rovlar ─────────────────────────

export const cashboxCardListKey = (includeInactive: boolean) =>
  [cashboxKey, "cards", "list", { includeInactive }] as const;
export const cashboxCardLedgerKey = (id: string, params: CashboxCardLedgerParams) =>
  [cashboxKey, "cards", "ledger", id, params] as const;

/** `GET finance/cashbox/cards` — to'liq ro'yxat (oyna ochilgandagina: `enabled`). */
export const useCashboxCards = ({ includeInactive = true, enabled = true }: { includeInactive?: boolean; enabled?: boolean } = {}) =>
  useQuery({
    queryKey: cashboxCardListKey(includeInactive),
    queryFn: () =>
      api
        .get(API_ENDPOINTS.CASHBOX.CARDS, { params: includeInactive ? { include_inactive: true } : undefined })
        .then((res) => normalizeCashboxCardList(res.data)),
    enabled,
    // Oyna o'z `ErrorState` ini chizadi.
    meta: { silentError: true },
  });

/** `GET finance/cashbox/cards/:id/ledger`. */
export const useCashboxCardLedger = (id: string | null, params: CashboxCardLedgerParams, enabled = true) =>
  useQuery({
    queryKey: cashboxCardLedgerKey(String(id ?? ""), params),
    queryFn: () =>
      api
        .get(API_ENDPOINTS.CASHBOX.CARD_LEDGER(String(id)), {
          params: { ...cashboxCardLedgerQuery(params), page: params.page, limit: params.limit },
        })
        .then((res) => normalizeCashboxCardLedger(res.data)),
    enabled: Boolean(id) && enabled,
    // Sahifa / davr almashganda eski qatorlar ko'rinib turadi (jadval sakramaydi).
    placeholderData: keepPreviousData,
    meta: { silentError: true },
  });

/** Ko'chirmani Excelga yuklash (`GET …/ledger/export`, oraliqdagi hamma qator). */
export const exportCashboxCardLedger = (
  id: string,
  range: Pick<CashboxCardLedgerParams, "from" | "to">,
  fileName: string,
) => downloadXlsx(API_ENDPOINTS.CASHBOX.CARD_LEDGER_EXPORT(id), cashboxCardLedgerQuery(range), fileName);

/** Har karta yozuvidan keyin: kassa so'rovlari (kartalar ham) + smena sozlamalaridagi karta ro'yxati. */
export const refreshCashboxCardQueries = (client: QueryClient) =>
  Promise.all([refreshCashboxQueries(client), client.invalidateQueries({ queryKey: shiftCheckSettingsKey })]);

/** Natijasi noma'lum xatodan keyin (504, tarmoq) ro'yxatni qayta o'qish. */
export const useRefreshCashboxCards = () => {
  const client = useQueryClient();
  return useCallback(() => refreshCashboxCardQueries(client), [client]);
};

export type CashboxCardDetailsBody = {
  kind?: CashboxCardKind;
  bank_name?: string;
  card_network?: string;
  /** `""` — tozalash (faqat tahrirda). */
  last4?: string;
  holder_name?: string;
  note?: string;
  /** Faqat superadmin (admin yuborsa — 403). */
  require_photo_on_shift_close?: boolean;
  ai_check_enabled?: boolean;
};

export type CreateCashboxCardBody = CashboxCardDetailsBody & { name: string; make_default?: boolean };
export type UpdateCashboxCardBody = CashboxCardDetailsBody & { name?: string };

export type CashboxCardTransferBody = { from_card_id: string; to_card_id: string; amount: number; comment: string };
export type CashboxCardConvertBody = {
  type: "card_to_cash" | "cash_to_card";
  card_id: string;
  amount: number;
  comment: string;
};
export type CashboxCardDeleteBody = { move_to?: "card" | "cash"; to_card_id?: string; comment?: string };

const idempotencyHeaders = (idempotencyKey: string) => ({ headers: { "Idempotency-Key": idempotencyKey } });

/** Muvaffaqiyatdan keyin yangilash — kutilmaydi (oyna darhol yopilsin; sekin tarmoqda ro'yxat fonda keladi). */
const useCardMutationRefresh = () => {
  const client = useQueryClient();
  return () => {
    void refreshCashboxCardQueries(client);
  };
};

export const useCreateCashboxCard = () => {
  const onSuccess = useCardMutationRefresh();
  return useMutation({
    mutationFn: (body: CreateCashboxCardBody) => api.post(API_ENDPOINTS.CASHBOX.CARDS, body),
    onSuccess,
  });
};

export const useUpdateCashboxCard = () => {
  const onSuccess = useCardMutationRefresh();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCashboxCardBody }) =>
      api.patch(API_ENDPOINTS.CASHBOX.CARD(id), body),
    onSuccess,
  });
};

export const useMakeDefaultCashboxCard = () => {
  const onSuccess = useCardMutationRefresh();
  return useMutation({
    mutationFn: (id: string) => api.post(API_ENDPOINTS.CASHBOX.CARD_MAKE_DEFAULT(id)),
    onSuccess,
  });
};

export const useSetCashboxCardActive = () => {
  const onSuccess = useCardMutationRefresh();
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(API_ENDPOINTS.CASHBOX.CARD_STATUS(id), { is_active }),
    onSuccess,
  });
};

export const useTransferCashboxCards = () => {
  const onSuccess = useCardMutationRefresh();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: CashboxCardTransferBody; idempotencyKey: string }) =>
      api.post(API_ENDPOINTS.CASHBOX.CARD_TRANSFER, body, idempotencyHeaders(idempotencyKey)),
    onSuccess,
  });
};

export const useConvertCashboxCard = () => {
  const onSuccess = useCardMutationRefresh();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: CashboxCardConvertBody; idempotencyKey: string }) =>
      api.post(API_ENDPOINTS.CASHBOX.CARD_CONVERT, body, idempotencyHeaders(idempotencyKey)),
    onSuccess,
  });
};

/** `POST finance/cashbox/cards/:id/delete` — qoldiq bo'lsa `move_to` bilan bitta so'rovda o'tkaziladi va o'chiriladi. */
export const useDeleteCashboxCard = () => {
  const onSuccess = useCardMutationRefresh();
  return useMutation({
    mutationFn: ({ id, body, idempotencyKey }: { id: string; body: CashboxCardDeleteBody; idempotencyKey: string }) =>
      api.post(API_ENDPOINTS.CASHBOX.CARD_DELETE(id), body, idempotencyHeaders(idempotencyKey)),
    onSuccess,
  });
};
