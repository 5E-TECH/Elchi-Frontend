import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWatch, type Control } from "react-hook-form";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/config/store";
import { markets, useMarkets } from "../../../../entities/markets";
import { useUser } from "../../../../entities/user/api/userApi";
import { api } from "../../../../shared/api/api";
import { API_ENDPOINTS } from "../../../../shared/api";
import { toApiList, type OrderCreateFormValues } from "../model/orderCreateForm";
import { canSeeMarketTariffs, hasTariffFields, readMarketTariffs, type MarketTariffs } from "../model/orderPricing";

export type MarketTariffsState = {
  /** Rol narxni ko'radimi (superadmin, admin, market, menejer, registrator). `false` — narx umuman chizilmaydi. */
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
 *  - menejer, registrator: `GET markets` qatorida tariflar bor (N3, yiFTzkzH — backend 3b23c75); qatorsiz market
 *    (faqat id va nom) bo'lsa — `GET markets?search=<nom>` dan id bo'yicha (`GET users/:id` ularga yopiq).
 * So'rov xatosi jim (`silentError`): narx shunchaki ko'rsatilmaydi, «Narx yo'q» deyilmaydi.
 */
export const useMarketTariffs = (control: Control<OrderCreateFormValues>): MarketTariffsState => {
  const role = useSelector((state: RootState) => state.role.role);
  const visible = canSeeMarketTariffs(role);
  const isMarketRole = role === "market";
  const market = useWatch({ control, name: "market" });

  const fromRow = !isMarketRole && market != null && hasTariffFields(market);
  const marketId = market ? Number(market.id) : 0;
  // Menejer va registrator `GET users/:id` bilan marketni ko'ra olmaydi (menejer — faqat o'z filiali xodimlari,
  // registrator — umuman): qatorsiz market (faqat id va nom) tariflari `GET markets?search=<nom>` dan id bo'yicha.
  const branchStaff = role === "manager" || role === "registrator";
  const needsFetch = visible && !isMarketRole && market != null && !fromRow;
  const marketName = market?.name?.trim() ?? "";

  const { useGetMarketById } = useMarkets();
  const marketQuery = useGetMarketById(marketId, needsFetch && !branchStaff, {
    silentError: true,
  });
  const listQuery = useQuery({
    queryKey: [markets, "tariffs", marketId, marketName],
    queryFn: async () => {
      const { data } = await api.get(API_ENDPOINTS.MARKETS.BASE, { params: { search: marketName, limit: 20 } });
      const rows = toApiList<Record<string, unknown>>(data);
      const list = rows.length ? rows : toApiList<Record<string, unknown>>((data as { data?: unknown } | null)?.data);
      return list.find((row) => String(row.id) === String(marketId)) ?? null;
    },
    enabled: needsFetch && branchStaff && marketId > 0 && marketName !== "",
    meta: { silentError: true },
  });
  const { useGetMyProfile } = useUser();
  // O'z kartasi faqat market rolida so'raladi.
  const profileQuery = useGetMyProfile({ silentError: true, enabled: visible && isMarketRole });

  return useMemo<MarketTariffsState>(() => {
    if (!visible) return { visible, status: "idle", tariffs: null };
    if (isMarketRole) return fromQuery(visible, profileQuery);
    if (!market) return { visible, status: "idle", tariffs: null };
    if (fromRow) return { visible, status: "ready", tariffs: readMarketTariffs(market) };
    return fromQuery(visible, branchStaff ? listQuery : marketQuery);
  }, [branchStaff, fromRow, isMarketRole, listQuery, market, marketQuery, profileQuery, visible]);
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

