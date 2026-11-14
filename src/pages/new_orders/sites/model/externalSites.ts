import { useMemo } from "react";
import {
  useGetIntegrations,
  type Integration,
  type IntegrationParams,
  type IntegrationsResponse,
} from "../../../../entities/integrations";

/** «Tashqi saytlar» tabidagi qator — QR bo'yicha buyurtma olinadigan ulanish. */
export type ExternalSite = {
  integration: Integration;
  /** Buyurtmalar shu market nomidan yaratiladi (ulanishdagi `market_id`). */
  marketName: string | null;
};

/** Faqat faol ulanishlar; ro'yxat kichik (o'nlab), shuning uchun bitta sahifa. */
export const EXTERNAL_SITES_PARAMS: IntegrationParams = { is_active: "true", page: 1, limit: 100 };

/**
 * QAYSI ULANISH «SAYT».
 *
 * Buyurtma yaratish uchun ulanishda market bo'lishi SHART — backend `market_id` siz 400 beradi. Rol bo'yicha
 * qat'iy (`source`) tanlanmadi: migratsiya eski yozuvlarga sukut `carrier` qo'ygan va Donoxon kabi saytlar
 * hali shunday turibdi (`pages/integrations/connections.ts` dagi izoh) — ular ro'yxatdan tushib qolardi.
 * To'lov tizimi buyurtma bermaydi — chiqariladi.
 */
export const isExternalSite = (integration: Integration): boolean =>
  Boolean(integration.is_active) && Boolean(integration.market_id) && integration.role !== "payment";

const marketNameOf = (market: unknown): string | null => {
  const record = market as { name?: unknown; username?: unknown } | null | undefined;
  const name = typeof record?.name === "string" ? record.name.trim() : "";
  return name || null;
};

/**
 * `GET /integrations` javobi → saytlar. Backend ro'yxatda market obyektini qatordan olib, alohida `markets`
 * massiviga qo'yadi — nom shu yerdan `market_id` bo'yicha olinadi.
 */
export const toExternalSites = (body?: IntegrationsResponse): ExternalSite[] => {
  const items = Array.isArray(body?.data?.items) ? body.data.items : [];
  const markets = new Map<string, string | null>();
  for (const market of Array.isArray(body?.data?.markets) ? body.data.markets : []) {
    const id = (market as { id?: unknown } | null)?.id;
    if (id !== undefined && id !== null) markets.set(String(id), marketNameOf(market));
  }
  return items.filter(isExternalSite).map((integration) => ({
    integration,
    marketName: marketNameOf(integration.market) ?? markets.get(String(integration.market_id)) ?? null,
  }));
};

export const useExternalSites = (options?: { enabled?: boolean }) => {
  const query = useGetIntegrations(EXTERNAL_SITES_PARAMS, { silentError: true, enabled: options?.enabled });
  const sites = useMemo(() => toExternalSites(query.data), [query.data]);
  return { query, sites };
};
