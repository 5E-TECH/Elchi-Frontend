import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import type { ISODateRange } from "../../shared/lib/dateRange";
import { aiUsageParams, normalizeAiOrders, normalizeAiUsageDashboard } from "./model/aiUsage";

export {
  ORDER_SOURCE_KEYS,
  aiUsageParams,
  normalizeAiOrders,
  normalizeAiUsageDashboard,
} from "./model/aiUsage";
export type {
  AiOrderItem,
  AiOrderSources,
  AiOrdersList,
  AiUsageDashboard,
  AiUsageDay,
  AiUsageFeatureRow,
  AiUsageModelRow,
  AiUsageSummary,
  OrderSourceKey,
} from "./model/aiUsage";

/** «AI buyurtmalar» ro'yxati — backend chegarasi (1..100). */
export const AI_ORDERS_LIMIT = 100;

/**
 * `GET /ai-usage/dashboard` (Celz3rKJ) — faqat SUPERADMIN/ADMIN; sahifa xatoni o'zi chizadi (`QueryBoundary`).
 * `enabled` — tab ochilgandagina so'raladi.
 */
export const useAiUsageDashboard = (range: ISODateRange | null, enabled = true) =>
  useQuery({
    queryKey: ["ai-usage", "dashboard", aiUsageParams(range)],
    queryFn: () =>
      api
        .get(API_ENDPOINTS.AI_USAGE.DASHBOARD, { params: aiUsageParams(range) })
        .then((res) => normalizeAiUsageDashboard(res.data)),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    meta: { silentError: true },
  });

/** `GET /ai-usage/ai-orders` — AI orqali yaratilgan buyurtmalar (eng yangisi birinchi). */
export const useAiOrders = (range: ISODateRange | null, enabled = true) =>
  useQuery({
    queryKey: ["ai-usage", "ai-orders", aiUsageParams(range)],
    queryFn: () =>
      api
        .get(API_ENDPOINTS.AI_USAGE.AI_ORDERS, { params: { ...aiUsageParams(range), limit: AI_ORDERS_LIMIT } })
        .then((res) => normalizeAiOrders(res.data)),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    meta: { silentError: true },
  });
