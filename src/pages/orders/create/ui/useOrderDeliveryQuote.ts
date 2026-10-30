import { useMemo } from "react";
import { useWatch, type Control } from "react-hook-form";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/config/store";
import {
  useDeliveryQuoteByTariff,
  type DeliveryQuote,
  type DeliveryQuoteState,
} from "../../../../entities/delivery-pricing";
import {
  buildOrderQuoteInput,
  quoteForDeliveryType,
  type OrderQuoteInput,
} from "../model/orderDeliveryQuote";
import type { OrderCreateFormValues } from "../model/orderCreateForm";
import { canSeeMarketTariffs } from "../model/orderPricing";
import { useOrderCatalog } from "./useOrderCatalog";

export type OrderDeliveryQuote = {
  /** Rol yetkazish narxini ko'radimi (standart narx bilan bir xil rollar — `canSeeMarketTariffs`). */
  visible: boolean;
  input: OrderQuoteInput;
  state: DeliveryQuoteState;
  /** Tanlangan yetkazish turining hisobi (`null` — hali yo'q yoki bu turga faol tarif yo'q). */
  quote: DeliveryQuote | null;
};

/**
 * Taxminiy yetkazish narxi (6NYcXvGy): tanlangan mahsulotlar o'lchovidan `POST /delivery/quote/by-tariff` (~400 ms
 * kutib, `useDeliveryQuoteByTariff`), natija — tanlangan tur bo'yicha. Katalog — `Step2Combined` bilan bir xil so'rov
 * (keshdan). O'lchovli mahsulot yo'q, rol narxni ko'rmaydi yoki `enabled` o'chiq (market standart narxi yo'q — qator
 * chizilmaydi) — so'rov ketmaydi.
 */
export const useOrderDeliveryQuote = (
  control: Control<OrderCreateFormValues>,
  enabled = true,
): OrderDeliveryQuote => {
  const role = useSelector((state: RootState) => state.role.role);
  const visible = canSeeMarketTariffs(role);
  const items = useWatch({ control, name: "details.items" });
  const whereDeliver = useWatch({ control, name: "details.where_deliver" });
  const { findProduct } = useOrderCatalog(control);
  const input = useMemo(() => buildOrderQuoteInput(items, findProduct), [findProduct, items]);
  const state = useDeliveryQuoteByTariff(input.items, { enabled: visible && enabled });
  return { visible, input, state, quote: quoteForDeliveryType(state.quotes, whereDeliver) };
};
