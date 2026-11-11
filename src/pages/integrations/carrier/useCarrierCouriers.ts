import { keepPreviousData, useQueries, useQuery, type QueryClient } from "@tanstack/react-query";
import axios from "axios";
import { cashboxByUserQuery } from "../../../entities/payments";
import { userDetailQuery, fetchUserList, user, type IUserFilter } from "../../../entities/user/api/userApi";
import { unwrapUserResponse } from "../../../entities/user/lib/normalizeUser";
import { toCarrierCourier, type CarrierCourier, type CourierInfo } from "./carrierModel";

/**
 * Tashqi yetkazuvchi konsolining KURYER ma'lumotlari — `admin/carriers` faqat `courier_user_id` beradi.
 *
 * So'rov va kesh kaliti — entity fabrikalaridan (`userDetailQuery`, `cashboxByUserQuery`, `fetchUserList`), bu yerda
 * faqat Carrier API'ga xos o'qish (`toCarrierCourier`, holat, «Qabul qilinishi kerak»). Kalitlar mavjud o'quvchilar
 * bilan bir xil (`useGetUserById`, `useGetCashBoxById`, `useGetUser`): kuryer tahrirlangach yoki to'lov qabul
 * qilingach bu ekran ham yangilanadi (o'sha sahifalarning invalidatsiyasi).
 */

const statusOf = (error: unknown) =>
  axios.isAxiosError(error) ? error.response?.status : undefined;

/** Akkauntlardagi kuryerlar: `id → CourierInfo` (ro'yxat qatori, tafsilot, tasdiq oynalari). 404 — o'chirilgan. */
export const useLinkedCouriers = (ids: readonly string[], enabled: boolean) => {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  return useQueries({
    queries: unique.map((id) => ({
      ...userDetailQuery(id),
      enabled,
      // 404 — o'chirilgan foydalanuvchi: qayta urinilmaydi («Kuryer topilmadi» darhol).
      retry: (count: number, error: unknown) => statusOf(error) !== 404 && count < 1,
      staleTime: 30_000,
      meta: { silentError: true },
    })),
    combine: (results) => {
      const map = new Map<string, CourierInfo>();
      results.forEach((result, index) => {
        const id = unique[index];
        if (result.isPending) map.set(id, { state: "loading" });
        else if (result.isError)
          map.set(id, { state: statusOf(result.error) === 404 ? "missing" : "error" });
        else {
          const courier = toCarrierCourier(unwrapUserResponse(result.data));
          map.set(id, courier ? { state: "ready", courier } : { state: "missing" });
        }
      });
      return map;
    },
  });
};

/**
 * Server kuryerni rad etdi (400 «Kurier faol emas» / 404 «Kurier topilmadi») yoki band (409) — shu kuryerning
 * tafsiloti va kuryer tanlovi ro'yxatlari eskirgan: holat belgisi va qator holati («Faol») server javobiga mos
 * kelishi uchun darhol qayta so'raladi (aks holda 30 s `staleTime` davomida eski holat qolardi).
 */
export const invalidateCarrierCourier = (client: QueryClient, courierId: string) => {
  void client.invalidateQueries({ queryKey: [user, "detail", courierId] });
  void client.invalidateQueries({
    queryKey: [user],
    predicate: ({ queryKey }) => {
      const params = queryKey[1];
      return (
        Boolean(params) && typeof params === "object" && (params as IUserFilter).role === "courier"
      );
    },
  });
};

/**
 * «Qabul qilinishi kerak» — kuryer kassasi (`GET finance/cashbox/user/:id?cashbox_type=couriers&with_history=true`)
 * javobidagi `olinishi_kerak` («Kuryer kassasi» sahifasi ko'rsatadigan son): HQ kuryeri va filial savdosi
 * kutilmayotgan bo'lsa musbat balans, aks holda 0. Maydon yo'q yoki shakl kutilmagan — `null` («—»): balans
 * «qabul qilinadigan» deb ko'rsatilmaydi (HQ emas kuryerning naqdini superadmin olmaydi).
 */
export type CourierReceivable =
  | { state: "loading" }
  | { state: "ready"; value: number | null }
  | { state: "error" };

/**
 * ⚠️ `with_history: true` SHART: busiz finance-service kassaning o'zini qaytaradi va gateway C3 maydonlarini
 * (`olinishi_kerak`, `can_receive`, `is_hq_courier`) faqat `{ cashbox, history }` javobiga qo'shadi
 * (`finance-gateway.controller.ts` → `findCashboxByUser`). Tarixdan bitta qator — javob kichik bo'lsin.
 */
const COURIER_CASHBOX_PARAMS = {
  cashbox_type: "couriers",
  with_history: true,
  page: 1,
  limit: 1,
} as const;

const finite = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const readCourierReceivable = (raw: unknown): number | null => {
  const payload = (raw as { data?: unknown } | null | undefined)?.data;
  const entry = (Array.isArray(payload) ? payload[0] : payload) as
    Record<string, unknown> | undefined;
  if (!entry || typeof entry !== "object") return null;
  return finite(entry.olinishi_kerak);
};

export const useCourierReceivable = (
  courierId: string | undefined,
  enabled: boolean,
): CourierReceivable => {
  const query = useQuery({
    ...cashboxByUserQuery(courierId, COURIER_CASHBOX_PARAMS),
    enabled: enabled && Boolean(courierId),
    meta: { silentError: true },
  });
  if (query.isError) return { state: "error" };
  if (query.isPending) return { state: "loading" };
  return { state: "ready", value: readCourierReceivable(query.data) };
};

/** Yangi akkaunt uchun kuryerlar (`GET users?role=courier`, server qidiruvi; 50 tagacha). */
export const COURIER_PICKER_LIMIT = 50;

export const useCourierCandidates = (search: string, enabled: boolean) => {
  const params: IUserFilter = {
    role: "courier",
    limit: COURIER_PICKER_LIMIT,
    ...(search ? { search } : {}),
  };
  const query = useQuery({
    queryKey: [user, params],
    queryFn: () => fetchUserList(params),
    enabled,
    placeholderData: keepPreviousData,
    meta: { silentError: true },
  });
  const couriers: CarrierCourier[] = (query.data?.data.items ?? [])
    .map((item) => toCarrierCourier(item))
    .filter((item): item is CarrierCourier => item !== null);
  return {
    couriers,
    isLoading: query.isPending && enabled,
    isFetching: query.isFetching,
    isError: query.isError,
  };
};
