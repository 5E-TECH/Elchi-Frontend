import { useEffect, useMemo, useState } from "react";
import { useWatch, type Control } from "react-hook-form";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/config/store";
import { useOrderSourcePreview, type OrderSourcePreview, type ResolveSourceRequest } from "../../../../entities/warehouse";
import type { OrderCreateFormValues } from "./orderCreateForm";

/** Mahsulot / tuman o'zgarishidan keyin manba so'rovi kechikishi (har bosishda so'rov ketmasin). */
export const SOURCE_DEBOUNCE_MS = 400;

/**
 * 6kHnNH9j (ega qarori 5): «Qayerdan yuboriladi» bloki — superadmin, admin, registrator; market — faqat superadmin /
 * admin unga «Ombordan buyurtma yaratish» kalitini yoqgan bo'lsa (`my-profile.can_order_from_warehouse`). Menejer va
 * market operatori — yo'q (backend `WAREHOUSE_ORDER_ROLES` menejerga yopiq; operator qo'lda yaratmaydi).
 */
export const useCanChooseOrderSource = (): boolean => {
  const role = useSelector((state: RootState) => state.role.role);
  const canOrderFromWarehouse = useSelector((state: RootState) => state.user.user?.can_order_from_warehouse === true);
  return role === "superadmin" || role === "admin" || role === "registrator" || (role === "market" && canOrderFromWarehouse);
};

export type OrderSourceState =
  /** Blok ko'rinmaydi (rol). */
  | { kind: "off" }
  /** Tuman yoki katalog mahsuloti hali tanlanmagan. */
  | { kind: "idle" }
  /** Katalogda yo'q («maxsus») mahsulot bor — omborda bo'lmaydi, butun buyurtma HQ'dan. */
  | { kind: "custom" }
  | { kind: "loading" }
  | { kind: "error"; retry: () => void }
  | { kind: "ready"; preview: OrderSourcePreview };

export type OrderSourceResult = {
  state: OrderSourceState;
  /** Oxirgi javob (yangi so'rov ketayotganda ham — eski qiymat). */
  preview: OrderSourcePreview | null;
  /** Yaratilganda buyurtma qayerdan ketadi (tanlov hisobga olingan); hali noma'lum — `null`. */
  effective: "WAREHOUSE" | "HQ" | null;
  /** Yangi tana bo'yicha javob kutilmoqda (eski natija ko'rinib turadi). */
  pending: boolean;
  /** Mahsulot bo'yicha «Omborda: N» (ombor tekshirilgan bo'lsa). */
  stockOf: (productId: string | null | undefined) => { available: number; enough: boolean; warehouseName: string } | null;
};

/**
 * MANBA HOLATI — `POST /warehouses/resolve-source` (faqat hisoblaydi). Tana: tuman, viloyat, market (xodimda; market
 * tomonida token), katalog mahsulotlari va soni. Kechiktiriladi (`SOURCE_DEBOUNCE_MS`); bir xil tana — bitta so'rov
 * (`queryKeys.warehouses.resolveSource`), shuning uchun blok, mahsulot qatorlari va xulosa bir manbadan o'qiydi.
 */
export const useOrderSource = (control: Control<OrderCreateFormValues>, enabled: boolean): OrderSourceResult => {
  const role = useSelector((state: RootState) => state.role.role);
  const market = useWatch({ control, name: "market" });
  const items = useWatch({ control, name: "details.items" });
  const districtId = useWatch({ control, name: "customer.district_id" }) ?? "";
  const regionId = useWatch({ control, name: "customer.region_id" }) ?? "";
  const fulfillment = useWatch({ control, name: "fulfillment" });

  const hasCustom = (items ?? []).some((item) => item.product_id == null);
  const catalogItems = useMemo(
    () =>
      (items ?? [])
        .filter((item) => item.product_id != null && Number(item.quantity) >= 1)
        .map((item) => ({ product_id: String(item.product_id), quantity: Math.floor(Number(item.quantity)) })),
    [items],
  );

  const marketId = market?.id != null ? String(market.id) : null;
  const body = useMemo<ResolveSourceRequest | null>(() => {
    if (!enabled || hasCustom || !districtId || catalogItems.length === 0) return null;
    return {
      district_id: districtId,
      ...(regionId ? { region_id: regionId } : {}),
      // Market tomonida market tokendan — `market_id` yuborilmaydi.
      ...(role !== "market" && marketId ? { market_id: marketId } : {}),
      items: catalogItems,
    };
  }, [catalogItems, districtId, enabled, hasCustom, marketId, regionId, role]);

  const bodyKey = body ? JSON.stringify(body) : null;
  const [settledKey, setSettledKey] = useState<string | null>(bodyKey);
  useEffect(() => {
    if (bodyKey === null) return;
    const timer = window.setTimeout(() => setSettledKey(bodyKey), SOURCE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [bodyKey]);
  // Tana bo'shasa (tuman yoki mahsulot olib tashlandi) — darhol so'rovsiz.
  const debouncedKey = bodyKey === null ? null : settledKey;
  const debouncedBody = useMemo<ResolveSourceRequest | null>(
    () => (debouncedKey ? (JSON.parse(debouncedKey) as ResolveSourceRequest) : null),
    [debouncedKey],
  );

  const query = useOrderSourcePreview(debouncedBody);
  // Tana o'zgargan, lekin hali kechikish tugamagan yoki javob eski tana uchun — «aniqlanmoqda».
  const stale = bodyKey !== debouncedKey || query.isPlaceholderData || query.isFetching;
  const preview = debouncedKey ? (query.data ?? null) : null;

  let state: OrderSourceState;
  if (!enabled) state = { kind: "off" };
  else if (hasCustom) state = { kind: "custom" };
  else if (!body) state = { kind: "idle" };
  else if (query.isError && !stale) state = { kind: "error", retry: () => void query.refetch() };
  else if (!preview || stale) state = preview ? { kind: "ready", preview } : { kind: "loading" };
  else state = { kind: "ready", preview };

  const effective: OrderSourceResult["effective"] =
    state.kind === "off" || state.kind === "idle" || state.kind === "loading" || state.kind === "error"
      ? fulfillment === "hq" && state.kind !== "off"
        ? "HQ"
        : null
      : state.kind === "custom"
        ? "HQ"
        : fulfillment === "hq"
          ? "HQ"
          : state.preview.source;

  const warehouseName = preview?.warehouse?.name ?? "";
  const lines = state.kind === "ready" && preview?.warehouse ? preview.items : [];
  const stockOf: OrderSourceResult["stockOf"] = (productId) => {
    if (!productId) return null;
    const line = lines.find((item) => item.productId === String(productId));
    return line ? { available: line.available, enough: line.enough, warehouseName } : null;
  };

  return { state, preview, effective, pending: body !== null && stale, stockOf };
};
