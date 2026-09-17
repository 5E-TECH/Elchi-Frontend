import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

/**
 * KIRUVCHI WEBHOOK JURNALI — ular bizga yuborgan hodisalar.
 *
 * ⚠️ NEGA KERAK BO'LDI. Butun kiruvchi diagnostika (imzo rad etildi,
 * posilka topilmadi, CRM bitimidan buyurtma yaratildi/yaratilmadi)
 * `provider_webhook_logs` ga yozilardi, lekin uni O'QIYDIGAN yo'l umuman
 * yo'q edi — na endpoint, na ekran. Ya'ni "xato jurnalda ko'rinadi" degan
 * butun loyiha amalda ishlamasdi: operator sababni faqat bazaga kirib
 * topa olardi.
 *
 * ⚠️ `SYNC_HISTORY` bilan ARALASHTIRMANG — u CHIQUVCHI yo'l (biz
 * yuborgan/tortib olgan sinxronlar). Bu esa teskari yo'nalish.
 *
 * ⚠️ Tana (`raw_body`) serverdan QAYTMAYDI: ichida mijozning telefoni va
 * manzili bo'ladi, ro'yxatdagi savol esa "nima bo'ldi", "mijoz kim" emas.
 */
export interface WebhookLogRow {
  id: string;
  createdAt: string;
  integration_id: string | null;
  provider_slug: string | null;
  delivery_id: string | null;
  event_type: string | null;
  signature_valid: boolean;
  status: string;
  /** Diagnostika sababi — `apply: inbound_failed — market_id ...` shaklida. */
  error: string | null;
  processed_at: string | null;
  trace_id: string | null;
}

export interface WebhookLogPage {
  items: WebhookLogRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const EMPTY: WebhookLogPage = {
  items: [],
  meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
};

/**
 * Javob qobig'i marshrutga qarab bir-ikki qatlam bo'ladi — himoyalangan
 * ochish, aks holda jadval sababsiz bo'sh ko'rinib qolardi.
 */
const unwrap = (raw: unknown): WebhookLogPage => {
  const outer = raw as { data?: unknown };
  const first = outer?.data ?? raw;
  const inner = (first as { data?: unknown })?.data ?? first;
  const page = inner as Partial<WebhookLogPage> | undefined;
  return {
    items: Array.isArray(page?.items) ? page!.items : [],
    meta: page?.meta ?? EMPTY.meta,
  };
};

export const webhookLogsKey = "integration-webhook-logs";

export const useWebhookLogs = (params: {
  integrationId?: string;
  status?: string;
  page?: number;
  limit?: number;
}) =>
  useQuery({
    queryKey: [webhookLogsKey, params.integrationId, params.status, params.page, params.limit],
    enabled: Boolean(params.integrationId),
    queryFn: () =>
      api
        .get(API_ENDPOINTS.INTEGRATIONS.WEBHOOK_LOGS, {
          params: {
            integration_id: params.integrationId,
            ...(params.status && params.status !== "all" ? { status: params.status } : {}),
            page: params.page ?? 1,
            limit: params.limit ?? 20,
          },
        })
        .then((res) => unwrap(res.data)),
    staleTime: 15_000,
  });

/**
 * Natija yorlig'i — `error` maydonidagi `apply: <natija>` dan o'qiladi.
 *
 * Backend diagnostikani `error` ustuniga yozadi, chunki `status` faqat
 * uch qiymatni biladi (`rejected`/`verified`/`processed`). Operator uchun
 * esa muhim savol boshqa: NIMA bo'ldi.
 */
export const webhookOutcome = (row: WebhookLogRow): { labelKey: string; color: string } => {
  if (!row.signature_valid) return { labelKey: "woBadSignature", color: "red" };
  if (row.status === "rejected") return { labelKey: "woRejected", color: "red" };

  const raw = row.error ?? "";
  const match = /apply:\s*([a-z_]+)/.exec(raw);
  const outcome = match?.[1] ?? "";

  const MAP: Record<string, { labelKey: string; color: string }> = {
    inbound_created: { labelKey: "woOrderCreated", color: "green" },
    inbound_duplicate: { labelKey: "woDuplicate", color: "default" },
    inbound_race: { labelKey: "woDuplicateRace", color: "default" },
    inbound_stage_skipped: { labelKey: "woOtherStage", color: "default" },
    inbound_other_funnel: { labelKey: "woOtherFunnel", color: "default" },
    inbound_timeout: { labelKey: "woTimeout", color: "orange" },
    inbound_failed: { labelKey: "woNotCreated", color: "red" },
    inbound_no_gate: { labelKey: "woNoGate", color: "red" },
    inbound_no_funnel: { labelKey: "woBadFunnelPath", color: "red" },
    inbound_no_stage: { labelKey: "woBadStagePath", color: "red" },
    inbound_no_deal: { labelKey: "woNoDeal", color: "red" },
    inbound_no_external_id: { labelKey: "woNoDealId", color: "red" },
    inbound_wrong_role: { labelKey: "woWrongRole", color: "red" },
    no_shipment: { labelKey: "woNoShipment", color: "orange" },
    no_paths: { labelKey: "woNoPaths", color: "orange" },
    no_status: { labelKey: "woNoStatus", color: "orange" },
    unmapped: { labelKey: "woUnmapped", color: "orange" },
    integration_inactive: { labelKey: "woInactive", color: "default" },
  };

  if (outcome && MAP[outcome]) return MAP[outcome];
  // Xato yo'q — hodisa toza qo'llanildi.
  return raw ? { labelKey: "woError", color: "red" } : { labelKey: "woApplied", color: "green" };
};
