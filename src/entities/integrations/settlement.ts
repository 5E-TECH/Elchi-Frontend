import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { silentErrorMeta, type SilentErrorOption } from "../../shared/lib/queryErrorEvents";

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
 * Tashuvchidan olingan to'lovni yozish.
 *
 * `order_ids` berilmasa backend eng eskisidan boshlab yopadi — bu ataylab:
 * qaysi buyurtma yopilgani muhim emas, qoldiq muhim. Aniq buyurtmalarni
 * yopish kerak bo'lsa ular alohida uzatiladi.
 */
export const useCreateRemittance = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ integrationId, ...body }: RemittanceInput) =>
      api.post(API_ENDPOINTS.INTEGRATIONS.REMITTANCES(integrationId), body).then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: [settlementKey] }),
  });
};
