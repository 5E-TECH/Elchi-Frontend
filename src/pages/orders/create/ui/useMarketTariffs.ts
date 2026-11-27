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
import type { DeliveryType } from "../../../../entities/order/types/order";
import { canSeeMarketTariffs, hasTariffFields, readMarketTariffs, type MarketTariffs } from "../model/orderPricing";
import { FULL_LIST_LIMIT } from "../../../../shared/config/listLimits";

export type MarketTariffsState = {
  /** Rol narxni ko'radimi (superadmin, admin, market, registrator). `false` — narx umuman chizilmaydi. */
  visible: boolean;
  /** `ready` — tariflar ma'lum (`tariffs` to'ldirilgan); `loading` / `error` / `idle` — narx chizilmaydi. */
  status: "idle" | "loading" | "ready" | "error";
  tariffs: MarketTariffs | null;
  /** Market kartasidagi sukut yetkazish TURI (`default_tariff`) — summa emas, narx ko'rmaydigan menejerda ham bor. */
  defaultType: DeliveryType | null;
};

/**
 * Tanlangan marketning standart narxlari (CS-B 1-band):
 *  - superadmin / admin: `GET markets` to'liq qatorida tariflar bor — tanlash oynasidan kelgan market shundan
 *    o'qiladi; `location.state.selectedMarket` (faqat id va nom) bo'lsa — `GET users/:id`;
 *  - market: `GET auth/my-profile` (o'z kartasi);
 *  - registrator: `GET markets` qatorida tariflar bor (N3, yiFTzkzH); qatorsiz market (faqat id va nom) bo'lsa —
 *    `GET markets?search=<nom>` dan id bo'yicha (`GET users/:id` unga yopiq);
 *  - menejer (D5NxxpJW): narx yo'q (`visible: false`), shu qatordan faqat sukut turi o'qiladi.
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
  const readsMarketRow = visible || role === "manager";
  const needsFetch = readsMarketRow && !isMarketRole && market != null && !fromRow;
  const marketName = market?.name?.trim() ?? "";

  const { useGetMarketById } = useMarkets();
  const marketQuery = useGetMarketById(marketId, needsFetch && !branchStaff, {
    silentError: true,
  });
  const listQuery = useQuery({
    queryKey: [markets, "tariffs", marketId, marketName],
    queryFn: async () => {
      // Nomi bo'yicha qidiruvdan id ni topadi — 20 dan ortiq nomdosh bo'lsa ham kerakli market qolib ketmasin.
      const { data } = await api.get(API_ENDPOINTS.MARKETS.BASE, { params: { search: marketName, limit: FULL_LIST_LIMIT } });
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
    const read = (): TariffRead => {
      if (!readsMarketRow) return { status: "idle", tariffs: null };
      if (isMarketRole) return fromQuery(profileQuery);
      if (!market) return { status: "idle", tariffs: null };
      if (fromRow) return { status: "ready", tariffs: readMarketTariffs(market) };
      return fromQuery(branchStaff ? listQuery : marketQuery);
    };
    const { status, tariffs } = read();
    const defaultType = status === "ready" ? (tariffs?.defaultType ?? null) : null;
    // Narx ko'rmaydigan rolda (menejer) eski backend narx yuborsa ham — chiqmaydi.
    return visible
      ? { visible, status, tariffs, defaultType }
      : { visible, status: "idle", tariffs: null, defaultType };
  }, [branchStaff, fromRow, isMarketRole, listQuery, market, marketQuery, profileQuery, readsMarketRow, visible]);
};

type TariffRead = Pick<MarketTariffsState, "status" | "tariffs">;

type QueryLike = { data?: unknown; isError: boolean; isLoading: boolean; isFetching?: boolean };

const fromQuery = (query: QueryLike): TariffRead => {
  if (query.data !== undefined) {
    const tariffs = readMarketTariffs(query.data);
    return tariffs ? { status: "ready", tariffs } : { status: "error", tariffs: null };
  }
  if (query.isError) return { status: "error", tariffs: null };
  return { status: query.isLoading ? "loading" : "idle", tariffs: null };
};

