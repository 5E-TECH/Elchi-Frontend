import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { silentErrorMeta, type SilentErrorOption } from "../../shared/lib/queryErrorEvents";
import { metricsKey } from "./metrics";

/**
 * HISOB-KITOB — tashuvchi yig'gan COD va bizga qarzi.
 *
 * Tashuvchi (LDG kabi) posilkani yetkazadi va pulni MIJOZDAN o'zi yig'adi. O'sha pul bizga qarz bo'lib turadi,
 * keyin davriy o'tkazma («To'lov olindi») bilan yopiladi.
 *
 * ⚠️ TO'LOV ASOSIY KASSAGA O'ZI YOZILADI (N3yNa6rO): backend `createRemittance` summani MAIN kassaga kirim qiladi
 * (javobda `cashbox_posted`), bekor qilinsa — teskari chiqim. Ekran operatorga buni aytadi: pulni kassaga qo'lda
 * qayta kiritsa, u ikki marta yoziladi.
 *
 * Qoldiq (`receivable-balance`): `outstanding_amount` — yopilmagan qarz, `advance_balance` — oldingi to'lovlardan
 * ortib qolgan hamkor avansi, `payable_amount = max(0, outstanding − advance)` — to'lanishi kerak.
 *
 * «Olingan to'lovlar» (IS-3, DxdZFdIk): `GET integrations/:id/remittances` — yozilgan to'lovlar ro'yxati;
 * `POST …/remittances/:rid/cancel` — bekor qilish (o'chirish emas): qarzlar qayta ochiladi, kassaga yozilgan summa
 * teskari chiqim bilan qaytadi.
 */

export type ReceivableStatus = "pending" | "settled" | "cancelled";

export interface ReceivableRow {
  id: string | number;
  order_id: string;
  integration_id: string;
  provider_slug: string | null;
  external_ref: string | null;
  /** `numeric` — Postgres uni SATR qilib qaytaradi. */
  amount: string | number;
  status: ReceivableStatus;
  remittance_id: string | null;
  settled_at: string | null;
  createdAt?: string;
}

export interface ReceivableBalance {
  integration_id: string;
  /** Yopilmagan (PENDING) qarzlar yig'indisi. */
  outstanding_amount: number | string;
  outstanding_count: number;
  /** Hamkor avansi — oldingi to'lovlarning qarzga sig'magan qoldig'i (≥ 0). Eski backendda yo'q. */
  advance_balance?: number | string | null;
  /** To'lanishi kerak = max(0, yopilmagan qarz − avans). Eski backendda yo'q — `resolveBalance` o'zi hisoblaydi. */
  payable_amount?: number | string | null;
}

const unwrap = <T>(raw: unknown, fallback: T): T => {
  const outer = raw as { data?: unknown };
  const first = outer?.data ?? raw;
  const inner = (first as { data?: unknown })?.data ?? first;
  return (inner as T) ?? fallback;
};

/** `numeric` satr bo'lib kelishi mumkin — songa keltiriladi. */
export const toAmount = (v: string | number | null | undefined): number => {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? (n as number) : 0;
};

export interface BalanceSummary {
  /** Yopilmagan qarz. */
  outstanding: number;
  outstandingCount: number;
  /** Hamkor avansi (≥ 0). */
  advance: number;
  /** To'lanishi kerak (≥ 0). */
  payable: number;
  /** Qarz ham, to'lanadigan summa ham yo'q — «Qarz yo'q». */
  noDebt: boolean;
}

/**
 * Qoldiq javobini ekran uchun songa keltiradi. `payable_amount` kelmasa (eski backend) — formuladan:
 * `max(0, outstanding − advance)`; manfiy avans 0 deb olinadi (backend ham shunday qisadi).
 */
export const resolveBalance = (raw?: ReceivableBalance | null): BalanceSummary => {
  const outstanding = toAmount(raw?.outstanding_amount ?? 0);
  const outstandingCount = Math.max(0, Number(raw?.outstanding_count ?? 0) || 0);
  const advance = Math.max(0, toAmount(raw?.advance_balance ?? 0));
  const payable =
    raw?.payable_amount === undefined || raw?.payable_amount === null
      ? Math.max(0, outstanding - advance)
      : Math.max(0, toAmount(raw.payable_amount));
  return { outstanding, outstandingCount, advance, payable, noDebt: outstanding <= 0 && outstandingCount === 0 };
};

export const settlementKey = "integration-settlement";

export const useReceivableBalance = (integrationId?: string, options?: SilentErrorOption) =>
  useQuery({
    queryKey: [settlementKey, "balance", integrationId],
    enabled: Boolean(integrationId),
    queryFn: () =>
      api.get(API_ENDPOINTS.INTEGRATIONS.RECEIVABLE_BALANCE(integrationId!)).then((res) =>
        unwrap<ReceivableBalance>(res.data, {
          integration_id: integrationId!,
          outstanding_amount: 0,
          outstanding_count: 0,
          advance_balance: 0,
          payable_amount: 0,
        }),
      ),
    ...silentErrorMeta(options),
  });

export interface ReceivablesPage {
  items: ReceivableRow[];
  pagination: { total: number; page: number; limit: number };
}

export const useReceivables = (params: {
  integrationId?: string;
  status?: string;
  page?: number;
  limit?: number;
}, options?: SilentErrorOption) =>
  useQuery({
    queryKey: [settlementKey, "list", params.integrationId, params.status, params.page],
    enabled: Boolean(params.integrationId),
    queryFn: () =>
      api
        .get(API_ENDPOINTS.INTEGRATIONS.RECEIVABLES, {
          params: {
            integration_id: params.integrationId,
            ...(params.status && params.status !== "all" ? { status: params.status } : {}),
            page: params.page ?? 1,
            limit: params.limit ?? 20,
          },
        })
        .then((res) =>
          unwrap<ReceivablesPage>(res.data, {
            items: [],
            pagination: { total: 0, page: 1, limit: 20 },
          }),
        ),
    ...silentErrorMeta(options),
  });

export interface RemittanceInput {
  integrationId: string;
  amount: number;
  reference?: string;
  note?: string;
}

/**
 * `POST integrations/:id/remittances` javobi (backend `createRemittance`) ekran uchun songa keltirilgan.
 *
 *   `unapplied_amount = amount + advance_applied − settled_amount` — musbat bo'lsa hamkorning YANGI avansi bo'ladi;
 *   `advance_balance` — to'lovdan keyingi hamkor avansi; `cashbox_posted` — summa MAIN kassaga kirim bo'lib yozildimi
 *   (`false` — yozilmadi, operator kassa tarixini tekshirishi kerak). Javobda `created_at` yo'q — vaqt mijoz vaqti.
 *   `warning` (xom o'zbekcha matn) ataylab o'qilmaydi — ekran faqat i18n matn ko'rsatadi.
 */
export interface RemittanceResult {
  remittanceId: string | null;
  /** Olingan summa (`remitted_amount`; kelmasa — yuborilgan summa). */
  remitted: number;
  settledAmount: number;
  settledCount: number;
  /** Qarzga sig'magan qism (musbat — avansga o'tdi). */
  unapplied: number;
  /** Avvalgi avansdan ishlatilgani. */
  advanceApplied: number;
  /** To'lovdan keyingi hamkor avansi; eski backendda yo'q — `null`. */
  advanceBalance: number | null;
  /** `true` — MAIN kassaga kirim yozildi; `false`/`null` — yozilmadi yoki noma'lum. */
  cashboxPosted: boolean | null;
}

const optionalAmount = (v: unknown): number | null =>
  v === undefined || v === null || v === "" ? null : toAmount(v as string | number);

export const normalizeRemittanceResult = (raw: unknown, sentAmount: number): RemittanceResult => {
  const data = unwrap<Record<string, unknown> | null>(raw, null) ?? {};
  const id = data.remittance_id ?? data.id;
  const posted = data.cashbox_posted;
  return {
    remittanceId: id === undefined || id === null || id === "" ? null : String(id),
    remitted: optionalAmount(data.remitted_amount) ?? sentAmount,
    settledAmount: toAmount(data.settled_amount as string | number | undefined),
    settledCount: Math.max(0, Number(data.settled_count ?? 0) || 0),
    unapplied: toAmount(data.unapplied_amount as string | number | undefined),
    advanceApplied: Math.max(0, toAmount(data.advance_applied as string | number | undefined)),
    advanceBalance: optionalAmount(data.advance_balance),
    cashboxPosted: typeof posted === "boolean" ? posted : null,
  };
};

/**
 * Summa qarzga ANIQ tushdi va kassaga yozildi — natija oynasi kerak emas, faqat xabar (maket
 * `*-settlement-pay-dialog` «Boshqa holatlar»). Avansga o'tsa, avansdan ishlatilsa yoki kassaga yozilmasa — oyna.
 */
export const isExactRemittance = (result: RemittanceResult): boolean =>
  result.cashboxPosted === true && result.settledCount > 0 && result.unapplied === 0 && result.advanceApplied === 0;

/** Pul ayirmasi tiyin aniqligida (suzuvchi nuqta qoldig'isiz — backend ham tiyinda hisoblaydi). */
const subtractMoney = (a: number, b: number) => Math.round((a - b) * 100) / 100;

export interface OverpayPreview {
  /** «To'lanishi kerak» dan ortig'i. */
  excess: number;
  /** To'lovdan keyin hamkor avansi (= summa + avans − yopilmagan qarz; barcha qarz yopiladi). */
  advanceAfter: number;
  /** Yopiladigan qarz yozuvlari soni (hammasi). */
  recordsClosed: number;
}

/**
 * Ortiqcha summa (maket `*-settlement-pay-overpay-dialog`, ega S2): summa «to'lanishi kerak» dan katta bo'lsa —
 * barcha qarzlar yopiladi (FIFO: summa + avans ≥ yopilmagan qarz), ortig'i hamkor avansiga o'tadi. Yozish
 * bloklanmaydi. Qoldiq o'qilmagan bo'lsa (`summary = null`) — oldindan aytib bo'lmaydi, `null`.
 */
export const overpayPreview = (amount: number, summary: BalanceSummary | null): OverpayPreview | null => {
  if (!summary || !Number.isFinite(amount) || amount <= 0 || amount <= summary.payable) return null;
  return {
    excess: subtractMoney(amount, summary.payable),
    advanceAfter: Math.max(0, subtractMoney(amount + summary.advance, summary.outstanding)),
    recordsClosed: summary.outstandingCount,
  };
};

/**
 * Tashuvchidan olingan to'lovni yozish.
 *
 * `order_ids` berilmasa backend eng eskisidan boshlab yopadi — bu ataylab:
 * qaysi buyurtma yopilgani muhim emas, qoldiq muhim. Aniq buyurtmalarni
 * yopish kerak bo'lsa ular alohida uzatiladi.
 *
 * Muvaffaqiyatdan keyin hisob-kitob kalitlari (`settlementKey`: qoldiq, qarz yozuvlari, ulanish «Umumiy holat»
 * qoldig'i) va ulanish ko'rsatkichlari (`metricsKey` — «Umumiy holat» dagi COD «To'langan») yangilanadi. Summa MAIN kassaga ham yoziladi — kassa, moliya tarixi, bosh sahifa, daromad, KPI va
 * marketlar kalitlarini sahifa `refreshCashboxQueries` (entities/payments) bilan yangilaydi (entity'lar bir-birini
 * import qilmaydi).
 */
export const useCreateRemittance = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ integrationId, ...body }: RemittanceInput) =>
      api
        .post(API_ENDPOINTS.INTEGRATIONS.REMITTANCES(integrationId), body)
        .then((res) => normalizeRemittanceResult(res.data, body.amount)),
    onSuccess: () => {
      // Ko'rsatkichlar (24/48 soatlik) kutilmaydi — «Yozish» faqat hisob-kitob qayta o'qilguncha band.
      void client.invalidateQueries({ queryKey: metricsKey });
      return client.invalidateQueries({ queryKey: [settlementKey] });
    },
  });
};

/* ═══════════════════════ «OLINGAN TO'LOVLAR» (IS-3, DxdZFdIk) ═══════════════════════ */

export type RemittanceStatus = "active" | "cancelled";

/** `GET integrations/:id/remittances` qatori (backend `listRemittances`). */
export interface RemittanceRow {
  id: string | number;
  integration_id?: string;
  created_at?: string | null;
  amount: string | number;
  settled_count?: number | string | null;
  /** NULL — migratsiyadan oldingi yozuv. */
  settled_amount?: string | number | null;
  unapplied_amount?: string | number | null;
  /** NULL — eski yozuv (avans hisobiga kirmaydi). */
  advance_applied?: string | number | null;
  reference?: string | null;
  note?: string | null;
  status?: string | null;
  /** `true` — MAIN kassaga kirim yozildi; `false` — yozilmadi; `null` — eski yozuv (noma'lum). */
  cashbox_posted?: boolean | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
}

/** Ekran uchun songa keltirilgan to'lov. Muallif (`created_by` id) chizilmaydi — ism backendda yo'q (BD2-10). */
export interface Remittance {
  id: string;
  createdAt: string | null;
  amount: number;
  settledCount: number;
  /** Yopilgan qarz yig'indisi; eski yozuvda `null`. */
  settledAmount: number | null;
  /** Qarzga sig'magan ortig'i (avansga o'tgani, ≥ 0). */
  toAdvance: number;
  /** Avvalgi avansdan ishlatilgani; eski yozuvda `null`. */
  advanceApplied: number | null;
  reference: string | null;
  note: string | null;
  status: RemittanceStatus;
  cashboxPosted: boolean | null;
  cancelledAt: string | null;
  cancelReason: string | null;
}

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export const normalizeRemittance = (row: RemittanceRow): Remittance => ({
  id: String(row.id),
  createdAt: text(row.created_at),
  amount: toAmount(row.amount),
  settledCount: Math.max(0, Number(row.settled_count ?? 0) || 0),
  settledAmount: optionalAmount(row.settled_amount),
  toAdvance: Math.max(0, toAmount(row.unapplied_amount ?? 0)),
  advanceApplied: optionalAmount(row.advance_applied),
  reference: text(row.reference),
  note: text(row.note),
  status: row.status === "cancelled" ? "cancelled" : "active",
  cashboxPosted: typeof row.cashbox_posted === "boolean" ? row.cashbox_posted : null,
  cancelledAt: text(row.cancelled_at),
  cancelReason: text(row.cancel_reason),
});

export interface RemittancesPage {
  items: Remittance[];
  pagination: { total: number; page: number; limit: number };
}

export type RemittanceStatusFilter = "all" | RemittanceStatus;

export interface RemittancesParams {
  integrationId?: string;
  status?: RemittanceStatusFilter;
  /** `YYYY-MM-DD` (Toshkent kuni) yoki bo'sh. */
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

/** Javob qobig'i turlicha bo'lishi mumkin (`{ items }`, massiv yoki bo'sh) — har doim sahifa shakli. */
export const normalizeRemittancesPage = (raw: unknown, page: number, limit: number): RemittancesPage => {
  const data = unwrap<unknown>(raw, null);
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as { items?: unknown } | null)?.items)
      ? ((data as { items: unknown[] }).items)
      : [];
  const pagination = (data as { pagination?: Partial<RemittancesPage["pagination"]> } | null)?.pagination;
  const items = (list as RemittanceRow[]).filter((r) => r && r.id !== undefined && r.id !== null).map(normalizeRemittance);
  return {
    items,
    pagination: {
      total: Number(pagination?.total ?? items.length) || 0,
      page: Number(pagination?.page ?? page) || page,
      limit: Number(pagination?.limit ?? limit) || limit,
    },
  };
};

export const useRemittances = (params: RemittancesParams, options?: SilentErrorOption) => {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;
  return useQuery({
    queryKey: [settlementKey, "remittances", params.integrationId, params.status ?? "all", params.from ?? "", params.to ?? "", page, limit],
    enabled: Boolean(params.integrationId),
    queryFn: () =>
      api
        .get(API_ENDPOINTS.INTEGRATIONS.REMITTANCES(params.integrationId!), {
          params: {
            ...(params.status && params.status !== "all" ? { status: params.status } : {}),
            ...(params.from ? { from_date: params.from } : {}),
            ...(params.to ? { to_date: params.to } : {}),
            page,
            limit,
          },
        })
        .then((res) => normalizeRemittancesPage(res.data, page, limit)),
    ...silentErrorMeta(options),
  });
};

/** Pul tiyinda (backend `toTiyin` kabi) — avans solishtiruvi suzuvchi nuqta xatosiz. */
const tiyin = (v: number) => Math.round(v * 100);

/**
 * To'lovning hamkor avansiga sof hissasi (backend `remittanceAdvanceContribution`): `max(unapplied, 0) −
 * advance_applied`; eski yozuvda (`advance_applied = null`) — 0.
 */
export const remittanceAdvanceContribution = (r: Remittance): number =>
  r.advanceApplied === null ? 0 : (tiyin(r.toAdvance) - tiyin(r.advanceApplied)) / 100;

export interface CancelBlock {
  /** Keyingi to'lov(lar)da ishlatilgan avans (so'm). */
  used: number;
  /** Shu sahifadagi, avansni ishlatgan keyingi faol to'lovlar (№) — topilmasa bo'sh. */
  consumers: string[];
}

/**
 * «Hozir bekor qilib bo'lmaydi» — frontda oldindan (backend `assertAdvanceNotConsumed` ning nusxasi, 409 zaxira):
 * to'lovdan qolgan avans keyingi to'lovda qarz yopishga ishlatilgan bo'lsa (hissa > hozirgi avans) — bekor qilinsa
 * yopilgan qarzlar ortida kelmagan pul qolardi. Qoldiq o'qilmagan bo'lsa (`advanceBalance = null`) — aytib
 * bo'lmaydi, `null` (backend 409 i hal qiladi).
 */
export const cancelBlock = (
  row: Remittance,
  advanceBalance: number | null,
  siblings: readonly Remittance[] = [],
): CancelBlock | null => {
  if (row.status !== "active" || advanceBalance === null) return null;
  const contribution = tiyin(remittanceAdvanceContribution(row));
  const pool = tiyin(Math.max(0, advanceBalance));
  if (contribution <= 0 || pool - contribution >= 0) return null;
  const since = row.createdAt ? Date.parse(row.createdAt) : NaN;
  const consumers = siblings
    .filter(
      (r) =>
        r.id !== row.id &&
        r.status === "active" &&
        (r.advanceApplied ?? 0) > 0 &&
        (Number.isNaN(since) || !r.createdAt || Date.parse(r.createdAt) >= since),
    )
    .map((r) => r.id);
  return { used: (contribution - pool) / 100, consumers };
};

export interface CancelRemittanceInput {
  integrationId: string;
  remittanceId: string;
  reason: string;
  /** Faqat eski yozuvda (`cashbox_posted = null`) — operatorning aniq tanlovi; yangisida yuborilmaydi. */
  reverseCashbox?: boolean;
}

/** `POST …/cancel` javobi. `message` (xom o'zbekcha matn) ataylab o'qilmaydi. */
export interface CancelRemittanceResult {
  /** To'lov allaqachon bekor qilingan edi (qayta bosish / boshqa operator) — hech narsa o'zgarmadi. */
  idempotent: boolean;
  reopenedCount: number;
  cashboxReversed: boolean;
  amount: number;
}

export const normalizeCancelResult = (raw: unknown): CancelRemittanceResult => {
  const data = unwrap<Record<string, unknown> | null>(raw, null) ?? {};
  return {
    idempotent: data.idempotent === true,
    reopenedCount: Math.max(0, Number(data.reopened_count ?? 0) || 0),
    cashboxReversed: data.cashbox_reversed === true,
    amount: toAmount(data.amount as string | number | undefined),
  };
};

/**
 * To'lovni bekor qilish (DELETE emas). Backend idempotent: bekor qilingan to'lovga qayta so'rov `idempotent: true`
 * qaytaradi. Muvaffaqiyatda hisob-kitob (qoldiq, qarz yozuvlari, to'lovlar) va ko'rsatkichlar qayta o'qiladi; kassa
 * kalitlarini sahifa `refreshCashboxQueries` bilan yangilaydi.
 */
export const useCancelRemittance = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ integrationId, remittanceId, reason, reverseCashbox }: CancelRemittanceInput) =>
      api
        .post(API_ENDPOINTS.INTEGRATIONS.REMITTANCE_CANCEL(integrationId, remittanceId), {
          reason,
          ...(typeof reverseCashbox === "boolean" ? { reverse_cashbox: reverseCashbox } : {}),
        })
        .then((res) => normalizeCancelResult(res.data)),
    onSettled: () => {
      // Xatoda ham (409 — ro'yxat eskirgan bo'lishi mumkin) qayta o'qiladi.
      void client.invalidateQueries({ queryKey: metricsKey });
      return client.invalidateQueries({ queryKey: [settlementKey] });
    },
  });
};
