import { useCallback, useMemo } from "react";
import { useMarkets } from "../../markets";
import { formatPhone } from "../../../shared/lib/formatPhone";
import type { SelectOption } from "../../../shared/ui/primitives";

type MarketItem = {
  id?: string | number;
  name?: string;
  username?: string;
  phone_number?: string;
};

/** `GET /markets` javobi: massiv, `{ data: [] }`, `{ items: [] }` yoki `{ data: { items: [] } }`. */
const getMarketItems = (value: unknown): MarketItem[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value as MarketItem[];

  const response = value as Record<string, unknown>;
  const responseData = response.data;
  if (Array.isArray(responseData)) return responseData as MarketItem[];
  if (Array.isArray(response.items)) return response.items as MarketItem[];
  if (typeof responseData === "object" && responseData !== null) {
    const items = (responseData as Record<string, unknown>).items;
    if (Array.isArray(items)) return items as MarketItem[];
  }
  return [];
};

/** Sahifa va oynalar bitta so'rovni ulashadi (bir xil kalit — bitta kesh). */
const MARKET_PARAMS = { status: "active", limit: 100 } as const;

/**
 * Faol marketlar: oynadagi tanlov variantlari va jadvaldagi nom (`GET /notifications` qatorida market nomi
 * yo'q — faqat `market_id`).
 */
export const useNotificationMarkets = (enabled = true) => {
  const { useGetMarkets } = useMarkets();
  const query = useGetMarkets(MARKET_PARAMS, enabled);

  const items = useMemo(() => getMarketItems(query.data), [query.data]);

  const options = useMemo<SelectOption[]>(
    () =>
      items
        .filter((market) => market.id !== undefined && market.id !== null && String(market.id) !== "")
        .map((market) => {
          const id = String(market.id);
          const phone = market.phone_number ? formatPhone(market.phone_number) : "";
          return {
            value: id,
            label: market.name?.trim() || market.username || `#${id}`,
            description: phone || market.username || undefined,
            searchText: [market.phone_number, market.username, id].filter(Boolean).join(" "),
          };
        }),
    [items],
  );

  const names = useMemo(() => new Map(options.map((option) => [option.value, option.label])), [options]);
  const getName = useCallback((marketId: string) => names.get(marketId), [names]);

  return { options, getName, isLoading: query.isLoading };
};
