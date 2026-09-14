import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

/**
 * ONLAYN TO'LOV TRANZAKSIYALARI.
 *
 * ⚠️ NEGA BU EKRAN KERAK. 6-bosqichning asosiy darsi: JURNALGA YOZISH ≠
 * KO'RINISH. To'lov yozuvlari bazaga tushardi, lekin ularni o'qiydigan yo'l
 * bo'lmasa "pul keldi, lekin buyurtmaga bog'lanmadi" holati hech kimga
 * ko'rinmaydi — ya'ni yo'qolgan pul.
 *
 * ⚠️ PUL KASSAGA YOZILMAYDI (foydalanuvchi qarori, 2026-09-13) — bu ro'yxat
 * hozircha yagona joy, u pulni ko'rsatadi. Kompaniya balansi bu summalarni
 * hali hisobga olmaydi.
 */
export interface PaymentRow {
  id: string;
  createdAt: string;
  integration_id: string;
  provider_transaction_id: string;
  order_id: string | null;
  order_ref: string | null;
  amount: number;
  currency: string;
  /** BIZNING holat: succeeded | failed | refunded | pending. */
  status: string;
  provider_status: string | null;
  /** Buyurtmaga qo'llanish natijasi — `recorded` bo'lmasa e'tibor kerak. */
  apply_outcome: string | null;
}

export interface PaymentPage {
  items: PaymentRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const EMPTY: PaymentPage = {
  items: [],
  meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
};

/** Javob qobig'i marshrutga qarab bir-ikki qatlam bo'ladi — himoyalangan ochish. */
const unwrap = (raw: unknown): PaymentPage => {
  const outer = raw as { data?: unknown };
  const first = outer?.data ?? raw;
  const inner = (first as { data?: unknown })?.data ?? first;
  const page = inner as Partial<PaymentPage> | undefined;
  return {
    items: Array.isArray(page?.items) ? page!.items : [],
    meta: page?.meta ?? EMPTY.meta,
  };
};

export const paymentsKey = "integration-payments";

export const usePayments = (params: {
  integrationId?: string;
  unappliedOnly?: boolean;
  page?: number;
  limit?: number;
}) =>
  useQuery({
    queryKey: [paymentsKey, params.integrationId, params.unappliedOnly, params.page, params.limit],
    enabled: Boolean(params.integrationId),
    queryFn: () =>
      api
        .get(API_ENDPOINTS.INTEGRATIONS.PAYMENTS, {
          params: {
            integration_id: params.integrationId,
            ...(params.unappliedOnly ? { unapplied_only: true } : {}),
            page: params.page ?? 1,
            limit: params.limit ?? 20,
          },
        })
        .then((res) => unwrap(res.data)),
    staleTime: 15_000,
  });

/**
 * Qo'llanish natijasi yorlig'i.
 *
 * ⚠️ `recorded` dan boshqa HAMMASI e'tibor talab qiladi — pul kelgan, lekin
 * buyurtmaga tegmagan. Ularni neytral ko'rsatish yo'qolgan pulni
 * yashirardi.
 */
export const paymentOutcome = (row: PaymentRow): { label: string; color: string } => {
  const MAP: Record<string, { label: string; color: string }> = {
    recorded: { label: "buyurtmaga yozildi", color: "green" },
    order_not_found: { label: "buyurtma topilmadi", color: "red" },
    order_ref_missing: { label: "havola yo'q", color: "red" },
    order_already_closed: { label: "buyurtma yopilgan", color: "red" },
    amount_exceeds_total: { label: "summa oshdi", color: "red" },
    amount_invalid: { label: "summa yaroqsiz", color: "red" },
    ignored_status: { label: "holat qo'llanmadi", color: "default" },
    timeout: { label: "javob kelmadi — tekshirish kerak", color: "orange" },
    error: { label: "xato", color: "red" },
  };
  if (row.apply_outcome && MAP[row.apply_outcome]) {
    return MAP[row.apply_outcome];
  }
  /**
   * `null` — yozuv band qilingan, lekin natija yozilmagan: jarayon yarim
   * yo'lda uzilgan. Bu aynan ko'rinishi kerak bo'lgan holat, shu bois
   * neytral EMAS.
   */
  if (!row.apply_outcome) {
    return { label: "natija yo'q — uzilgan", color: "orange" };
  }
  return { label: row.apply_outcome, color: "red" };
};
