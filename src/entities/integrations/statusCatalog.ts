import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";

/**
 * KANONIK STATUS KATALOGI (JnHK6bgV) — `GET integrations/status-catalog`.
 *
 * ⚠️ Ro'yxat FRONTENDDA YOZILMAYDI: backend uni `Order_status` enumidan
 * hosil qiladi. UI'da qo'lda yozilsa ikkisi vaqt o'tib ajralardi va xarita
 * jimgina ishlamay qolardi.
 */

export interface StatusCatalogEntry {
  /** Xaritada saqlanadigan haqiqiy qiymat (`on the road` kabi probelli ham). */
  code: string;
  /** i18n uchun xavfsiz slug (`on_the_road`). */
  key: string;
  /** Tarjima topilmasa ko'rsatiladigan o'zbekcha izoh. */
  meaning_uz: string;
}

export type InboundAction = "sell" | "cancel" | "return";

export interface StatusCatalog {
  shipment: StatusCatalogEntry[];
  payment: StatusCatalogEntry[];
  inbound_default_action: Partial<Record<string, InboundAction>>;
}

const unwrap = (raw: unknown): StatusCatalog | null => {
  const outer = raw as { data?: unknown };
  const inner = (outer?.data ?? raw) as Partial<StatusCatalog> | undefined;
  if (!inner || !Array.isArray(inner.shipment) || !Array.isArray(inner.payment)) return null;
  return {
    shipment: inner.shipment,
    payment: inner.payment,
    inbound_default_action: inner.inbound_default_action ?? {},
  };
};

export const useStatusCatalog = (enabled = true) =>
  useQuery({
    queryKey: ["integration-status-catalog"],
    enabled,
    // Statik ro'yxat — sessiya davomida qayta so'ralmaydi.
    staleTime: Infinity,
    queryFn: () => api.get(API_ENDPOINTS.INTEGRATIONS.STATUS_CATALOG).then((res) => unwrap(res.data)),
  });
