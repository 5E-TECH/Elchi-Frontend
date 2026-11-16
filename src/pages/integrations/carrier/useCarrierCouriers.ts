import { useMemo } from "react";
import { useQueries, useQuery, type QueryClient } from "@tanstack/react-query";
import axios from "axios";
import { cashboxByUserQuery } from "../../../entities/payments";
import { userDetailQuery, user, type IUserFilter } from "../../../entities/user/api/userApi";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import { queryKeys } from "../../../shared/config/queryKeys";
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
 * Server kuryerni rad etdi (400 «Kurier faol emas» / 404 «Kurier topilmadi» / 400 `courier_not_hq`) yoki band
 * (409) — shu kuryerning tafsiloti va kuryer tanlovi ro'yxatlari eskirgan: holat belgisi va qator holati («Faol»)
 * server javobiga mos kelishi uchun darhol qayta so'raladi (aks holda 30 s `staleTime` davomida eski holat qolardi).
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
  // «Yangi tashqi yetkazuvchi» tanlovi (HQ kuryerlari — `queryKeys.branches.carrierCouriers`).
  void client.invalidateQueries({
    queryKey: queryKeys.branches.all,
    predicate: ({ queryKey }) => queryKey[3] === "carrier-couriers",
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

/**
 * Yangi akkaunt uchun kuryerlar — FAQAT HQ'da ochilganlari (ega qarori 2026-11-15; backend `POST admin/carriers`
 * boshqasini 400 `courier_not_hq` bilan rad etadi): `GET branches/:hqId/users` (SUPERADMIN, ADMIN — konsol huquqi
 * bilan bir xil), `role: COURIER` qatorlari. Ro'yxat to'liq keladi — qidiruv mijoz tomonida (ism va telefon
 * raqamlari bo'yicha): avvalgi «barcha kuryerlarning birinchi 50 tasi» bo'shlig'i yo'q.
 * Kalit `["branches", hqId, "employees", …]` — filial xodimlari o'zgarganda (qo'shish / olib tashlash / kuryerni
 * o'tkazish — `["branches"]` invalidatsiyasi) bu ro'yxat ham yangilanadi.
 */
const readHqCouriers = (payload: unknown, hqBranchId: string): CarrierCourier[] => {
  const body = payload as { data?: unknown } | unknown[] | null | undefined;
  const rows = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
  const couriers: CarrierCourier[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    if (String(row.role ?? "").toUpperCase() !== "COURIER") continue;
    const userRaw = row.user && typeof row.user === "object" ? (row.user as Record<string, unknown>) : null;
    // Identity'da topilmagan (o'chirilgan) foydalanuvchi — tanlovga chiqmaydi.
    if (!userRaw) continue;
    const courier = toCarrierCourier({ ...userRaw, id: userRaw.id ?? row.user_id, branch: { id: hqBranchId } });
    if (courier) couriers.push(courier);
  }
  return couriers;
};

const digitsOf = (value: string) => value.replace(/\D+/g, "");

/** Qidiruv: ism (katta-kichik harfsiz) yoki telefon raqamlari (bo'shliq va `+` siz). */
export const matchCourierSearch = (courier: CarrierCourier, search: string) => {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  if (courier.name.toLowerCase().includes(query)) return true;
  const digits = digitsOf(query);
  return digits.length > 0 && digitsOf(courier.phone).includes(digits);
};

export const useHqCourierCandidates = (
  hqBranchId: string | null,
  hqName: string,
  search: string,
  enabled: boolean,
) => {
  const query = useQuery({
    queryKey: queryKeys.branches.carrierCouriers(hqBranchId ?? ""),
    queryFn: async () => {
      const response = await api.get(API_ENDPOINTS.BRANCHES.USERS(hqBranchId as string));
      return readHqCouriers(response.data, hqBranchId as string);
    },
    enabled: enabled && Boolean(hqBranchId),
    staleTime: 30_000,
    meta: { silentError: true },
  });
  const couriers = useMemo<CarrierCourier[]>(
    () =>
      (query.data ?? [])
        .filter((courier) => matchCourierSearch(courier, search))
        .map((courier) => ({ ...courier, branch: { id: courier.branch?.id ?? "", name: hqName } })),
    [hqName, query.data, search],
  );
  return {
    couriers,
    isLoading: query.isPending && enabled && Boolean(hqBranchId),
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  };
};
