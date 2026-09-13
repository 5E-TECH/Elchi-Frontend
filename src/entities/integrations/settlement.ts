import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/api';
import { API_ENDPOINTS } from '../../shared/api';

/**
 * HISOB-KITOB — tashuvchi yig'gan COD va bizga qarzi.
 *
 * NEGA KERAK. Tashuvchi (LDG kabi) posilkani yetkazadi va pulni MIJOZDAN
 * O'ZI yig'adi. O'sha pul bizga qarz bo'lib turadi, keyin davriy o'tkazma
 * bilan yopiladi. Ikki tomonning daftari ajralib ketmasligi uchun bitta
 * joyda solishtirish kerak — PCS'da aynan shunday ekran bor va u yaxshi
 * ishlaydi.
 *
 * ⚠️ BU EKRAN KASSA EMAS. Backend ham shunday deydi: "Reconciliation only —
 * does not post to a cashbox". Bu yerdagi to'lov yozuvi kassa balansiga
 * TEGMAYDI — u faqat "qancha yig'ildi / qancha to'landi" farqini yuritadi.
 * Kassa harakati alohida, odatdagi kassa oqimi orqali kiritiladi. Buni
 * ekranda ham aytish SHART, aks holda operator pulni ikki marta
 * kiritganini bilmay qoladi.
 */

export type ReceivableStatus = 'pending' | 'settled' | 'cancelled';

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
  outstanding_amount: number;
  outstanding_count: number;
}

const unwrap = <T,>(raw: unknown, fallback: T): T => {
  const outer = raw as { data?: unknown };
  const first = outer?.data ?? raw;
  const inner = (first as { data?: unknown })?.data ?? first;
  return (inner as T) ?? fallback;
};

/** `numeric` satr bo'lib kelishi mumkin — songa keltiriladi. */
export const toAmount = (v: string | number | null | undefined): number => {
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? (n as number) : 0;
};

export const money = (v: number) =>
  `${Math.round(v).toLocaleString('uz-UZ')} so'm`;

export const settlementKey = 'integration-settlement';

export const useReceivableBalance = (integrationId?: string) =>
  useQuery({
    queryKey: [settlementKey, 'balance', integrationId],
    enabled: Boolean(integrationId),
    queryFn: () =>
      api
        .get(API_ENDPOINTS.INTEGRATIONS.RECEIVABLE_BALANCE(integrationId!))
        .then((res) =>
          unwrap<ReceivableBalance>(res.data, {
            integration_id: integrationId!,
            outstanding_amount: 0,
            outstanding_count: 0,
          }),
        ),
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
}) =>
  useQuery({
    queryKey: [
      settlementKey,
      'list',
      params.integrationId,
      params.status,
      params.page,
    ],
    enabled: Boolean(params.integrationId),
    queryFn: () =>
      api
        .get(API_ENDPOINTS.INTEGRATIONS.RECEIVABLES, {
          params: {
            integration_id: params.integrationId,
            ...(params.status && params.status !== 'all'
              ? { status: params.status }
              : {}),
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
      api
        .post(API_ENDPOINTS.INTEGRATIONS.REMITTANCES(integrationId), body)
        .then((res) => res.data),
    onSuccess: () => client.invalidateQueries({ queryKey: [settlementKey] }),
  });
};
