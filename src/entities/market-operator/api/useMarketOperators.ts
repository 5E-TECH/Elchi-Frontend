import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MarketOperatorCommission, MarketOperatorList, MarketOperatorListParams } from "../model/types";
import {
  assignUnlinkedOrders,
  createMarketOperator,
  deleteMarketOperator,
  getMarketOperators,
  getSelectableMarketOperators,
  getUnlinkedOperatorOrders,
  updateMarketOperatorCommission,
  updateMarketOperatorWarehouseAccess,
} from "./marketOperatorApi";

/** So'rov kalitlari — shu entity ichida (`shared/config/queryKeys.ts` boshqa PR'lar egaligida). */
export const marketOperatorKeys = {
  all: ["market-operators"] as const,
  /** Boshqaruv sahifasi ro'yxatlari (`MarketOperatorList`) — tanlov ro'yxati (massiv) bu prefiksga kirmaydi. */
  lists: ["market-operators", "list"] as const,
  list: (params: MarketOperatorListParams) => ["market-operators", "list", params] as const,
  /** Tanlov ro'yxati: `marketId` — xodim tanlagan market, `null` — o'z marketi (market roli). */
  selectable: (marketId: string | null) => ["market-operators", "selectable", marketId ?? "own"] as const,
  /** 2026-11-20 — operatorga bog'lanmagan (ismi faqat matn) eski buyurtmalar guruhlari (market). */
  unlinkedOrders: ["market-operators", "unlinked-orders"] as const,
};

/**
 * `GET market-operators/unlinked-orders` (market). Qo'shimcha blok — xato bo'lsa sahifa uni ko'rsatmaydi
 * (`silentError`), asosiy ro'yxatga ta'sir qilmaydi.
 */
export const useUnlinkedOperatorOrders = (options: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: marketOperatorKeys.unlinkedOrders,
    queryFn: getUnlinkedOperatorOrders,
    enabled: options.enabled ?? true,
    meta: { silentError: true },
  });

/**
 * Ommaviy biriktirish. Natija noma'lum bo'lsa ham (tarmoq, bo'lak yiqildi) guruhlar qayta o'qiladi — qolgani
 * ko'rinadi, biriktirilgani qayta yuborilmaydi (backend operatori bor buyurtmani 409 bilan o'tkazib yuboradi).
 */
export const useAssignUnlinkedOrders = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: assignUnlinkedOrders,
    onSettled: () => queryClient.invalidateQueries({ queryKey: marketOperatorKeys.unlinkedOrders }),
  });
};

/**
 * `GET /market-operators/selectable` — buyurtma yaratishdagi «Operator» tanlovi. `ownMarket` (market roli) —
 * `market_id` yuborilmaydi, server o'z marketini tokendan oladi; qolgan rollar — `marketId` bilan, market
 * tanlanmaguncha so'rov ketmaydi. Ro'yxat bo'sh yoki xato bo'lsa forma erkin matnga qaytadi — umumiy xabar
 * chiqmaydi (`silentError`). Operator qo'shilsa / o'chirilsa (`marketOperatorKeys.all`) — ro'yxat ham yangilanadi.
 */
export const useSelectableMarketOperators = (
  marketId: string | null,
  options: { enabled?: boolean; ownMarket?: boolean } = {},
) => {
  const ownMarket = options.ownMarket ?? false;
  const scopedMarketId = ownMarket ? null : marketId?.trim() || null;
  return useQuery({
    queryKey: marketOperatorKeys.selectable(scopedMarketId),
    queryFn: () => getSelectableMarketOperators(scopedMarketId ?? undefined),
    enabled: (options.enabled ?? true) && (ownMarket || scopedMarketId !== null),
    meta: { silentError: true },
  });
};

/**
 * `GET /market-operators` — market o'z operatorlari. Xatoni sahifa o'zi chizadi (`QueryBoundary` → `ErrorState`),
 * shuning uchun umumiy xabar chiqmaydi (`silentError`). Sahifa/filtr almashganda eski ro'yxat turadi.
 */
export const useMarketOperators = (params: MarketOperatorListParams, options: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: marketOperatorKeys.list(params),
    queryFn: () => getMarketOperators(params),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    meta: { silentError: true },
  });

const useInvalidateOperators = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: marketOperatorKeys.all });
};

/** `POST /market-operators` (faqat ism, telefon, parol). Ro'yxatni chaqiruvchi yangilaydi (komissiya PATCH'idan keyin). */
export const useCreateMarketOperator = () => useMutation({ mutationFn: createMarketOperator });

export const useUpdateMarketOperatorCommission = () => {
  const invalidate = useInvalidateOperators();
  return useMutation({
    mutationFn: ({ id, commission }: { id: string; commission: MarketOperatorCommission }) =>
      updateMarketOperatorCommission(id, commission),
    onSettled: invalidate,
  });
};

export const useDeleteMarketOperator = () => {
  const invalidate = useInvalidateOperators();
  return useMutation({ mutationFn: deleteMarketOperator, onSettled: invalidate });
};

/** Yaratish oqimi tugagach (PATCH muvaffaqiyatli yoki yiqilgan) ro'yxatni yangilash. */
export const useRefreshMarketOperators = useInvalidateOperators;

/**
 * XtcEyQjb: «Ombordagi qoldiqni ko'radi» kaliti. OPTIMISTIK EMAS: kalit server javobigacha eski holatda turadi;
 * muvaffaqiyatda ro'yxat yangilanadi, xatoda o'zgarmaydi (xabarni chaqiruvchi ko'rsatadi).
 */
export const useUpdateMarketOperatorWarehouseAccess = () => {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateOperators();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => updateMarketOperatorWarehouseAccess(id, enabled),
    onSuccess: (operator) => {
      // Server tasdiqlagan qiymat darhol ro'yxatda (qayta so'rov kelguncha kalit eski holatga qaytib turmasin).
      queryClient.setQueriesData<MarketOperatorList>({ queryKey: marketOperatorKeys.lists }, (list) =>
        list
          ? {
              ...list,
              items: list.items.map((item) =>
                item.id === operator.id ? { ...item, can_view_warehouse_stock: operator.can_view_warehouse_stock } : item,
              ),
            }
          : list,
      );
      return invalidate();
    },
    // Xatoda kalit o'zgarmaydi; ro'yxat serverdagi haqiqiy holat bilan qayta o'qiladi (404 — operator o'chirilgan).
    onError: () => invalidate(),
  });
};
