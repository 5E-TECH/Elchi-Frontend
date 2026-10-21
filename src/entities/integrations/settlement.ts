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
