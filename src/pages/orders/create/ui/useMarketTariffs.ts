import { useMemo } from "react";
import { useWatch, type Control } from "react-hook-form";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/config/store";
import { useMarkets } from "../../../../entities/markets";
import { useUser } from "../../../../entities/user/api/userApi";
import type { OrderCreateFormValues } from "../model/orderCreateForm";
import { canSeeMarketTariffs, hasTariffFields, readMarketTariffs, type MarketTariffs } from "../model/orderPricing";

export type MarketTariffsState = {
  /** Rol narxni ko'radimi (superadmin, admin, market). `false` — narx umuman chizilmaydi (menejer, registrator). */
  visible: boolean;
  /** `ready` — tariflar ma'lum (`tariffs` to'ldirilgan); `loading` / `error` / `idle` — narx chizilmaydi. */
  status: "idle" | "loading" | "ready" | "error";
  tariffs: MarketTariffs | null;
};

/**
 * Tanlangan marketning standart narxlari (CS-B 1-band):
 *  - superadmin / admin: `GET markets` to'liq qatorida tariflar bor — tanlash oynasidan kelgan market shundan
 *    o'qiladi; `location.state.selectedMarket` (faqat id va nom) bo'lsa — `GET users/:id`;
 *  - market: `GET auth/my-profile` (o'z kartasi);
 *  - menejer, registrator: backend tarif bermaydi (N3) — `visible: false`.
 * So'rov xatosi jim (`silentError`): narx shunchaki ko'rsatilmaydi, «Narx yo'q» deyilmaydi.
 */
export const useMarketTariffs = (control: Control<OrderCreateFormValues>): MarketTariffsState => {
  const role = useSelector((state: RootState) => state.role.role);
  const visible = canSeeMarketTariffs(role);
  const isMarketRole = role === "market";
  const market = useWatch({ control, name: "market" });

  const fromRow = !isMarketRole && market != null && hasTariffFields(market);
  const marketId = market ? Number(market.id) : 0;

  const { useGetMarketById } = useMarkets();
  const marketQuery = useGetMarketById(marketId, visible && !isMarketRole && market != null && !fromRow, {
    silentError: true,
  });
  const { useGetMyProfile } = useUser();
  // O'z kartasi faqat market rolida so'raladi.
  const profileQuery = useGetMyProfile({ silentError: true, enabled: visible && isMarketRole });

  return useMemo<MarketTariffsState>(() => {
    if (!visible) return { visible, status: "idle", tariffs: null };
    if (isMarketRole) return fromQuery(visible, profileQuery);
    if (!market) return { visible, status: "idle", tariffs: null };
    if (fromRow) return { visible, status: "ready", tariffs: readMarketTariffs(market) };
    return fromQuery(visible, marketQuery);
  }, [fromRow, isMarketRole, market, marketQuery, profileQuery, visible]);
};

type QueryLike = { data?: unknown; isError: boolean; isLoading: boolean; isFetching?: boolean };

const fromQuery = (visible: boolean, query: QueryLike): MarketTariffsState => {
  if (query.data !== undefined) {
    const tariffs = readMarketTariffs(query.data);
    return tariffs ? { visible, status: "ready", tariffs } : { visible, status: "error", tariffs: null };
  }
  if (query.isError) return { visible, status: "error", tariffs: null };
  return { visible, status: query.isLoading ? "loading" : "idle", tariffs: null };
};

