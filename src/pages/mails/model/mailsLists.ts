import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import { useMails, type MailItem } from "../../../entities/mails";
import type { OrderListItem } from "../../../entities/order/types/order";
import { API_ENDPOINTS } from "../../../shared/api";
import { api } from "../../../shared/api/api";
import { getCurrentBranchId } from "../../../shared/lib/currentBranch";
import type { DataTableSort, Tone } from "../../../shared/ui/primitives";

/**
 * «POCHTA» RO'YXATLARI — ma'lumot hooklari va sof yordamchilar (dizayn v2).
 *
 * Qobiq (`pages/mails/index.tsx`) tab sonlarini va tab tanalari (`todaysMails`, `refusedMails`) ro'yxatni
 * SHU hooklardan oladi: queryKey'lar bir xil (`entities/mails`), shuning uchun son uchun qo'shimcha so'rov
 * ketmaydi — React Query bitta so'rovni ikkala joyga beradi.
 */

/* ─── Jadval qatori ───────────────────────────────────────────────────────── */

/** `MailsTable` qatori (pochta yoki paket). Kontrakt — `components/MailsTable.tsx`. */
export type MailsTableRow = {
  id: string;
  /** «№2486» (pochta) yoki «B-129» (paket). */
  displayId: string;
  createdAt: string;
  regionName: string;
  courierName?: string | null;
  orders: number;
  amount: number;
  /** Holat badge'i (ton + matn). `null` — badge chizilmaydi. */
  status: { tone: Tone; label: string } | null;
};

/** Pochta qatori: jadval ustunlari + tafsilotga o'tishdagi zaxira viloyat (`fix3` dispatch). */
export type MailListRow = MailsTableRow & { regionId: string };

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * API pochtasi → jadval qatori. Viloyat nomi bo'lmasa — `regionFallback(id)` («Viloyat 12»), v1 dagidek.
 * Kuryer — `courier.name` (rad etilganlarda backend beradi; bugungi YANGI pochtada kuryer hali yo'q).
 */
export const toMailListRow = (
  mail: MailItem,
  options: { status: MailsTableRow["status"]; regionFallback: (regionId: string) => string },
): MailListRow => {
  const regionId = String(mail.region?.id ?? mail.region_id ?? "");
  const courierName = mail.courier?.name?.trim();
  return {
    id: String(mail.id),
    displayId: `№${mail.id}`,
    createdAt: mail.createdAt,
    regionId,
    regionName: mail.region?.name?.trim() || options.regionFallback(String(mail.region_id ?? regionId)),
    courierName: courierName || null,
    orders: toNumber(mail.order_quantity),
    amount: toNumber(mail.post_total_price),
    status: options.status,
  };
};

export type MailRowsSummary = {
  /** Turli viloyatlar soni (viloyatsiz pochta — o'zi alohida). */
  regions: number;
  mails: number;
  orders: number;
  amount: number;
};

/** Xulosa qatori: «8 ta viloyat · 182 ta buyurtma · jami 34 760 000 so'm». */
export const summarizeMailRows = (rows: readonly MailListRow[]): MailRowsSummary => {
  const regions = new Set<string>();
  let orders = 0;
  let amount = 0;
  for (const row of rows) {
    regions.add(row.regionId || `mail:${row.id}`);
    orders += row.orders;
    amount += row.amount;
  }
  return { regions: regions.size, mails: rows.length, orders, amount };
};

const dateValue = (value: string): number => {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

/**
 * Mijoz tomonida saralash (kuryer jadvali: Pochta — sana, Buyurtmalar, Summa; eski pochtalarda — Holat).
 * `sort` yo'q — tartib o'zgarmaydi (API tartibi). Teng qatorlar o'z o'rnida qoladi.
 */
export const sortMailsRows = <R extends MailsTableRow>(
  rows: readonly R[],
  sort: DataTableSort | null | undefined,
  language = "uz",
): R[] => {
  if (!sort) return [...rows];
  const factor = sort.direction === "asc" ? 1 : -1;
  const compare = (left: R, right: R): number => {
    switch (sort.key) {
      case "createdAt":
        return dateValue(left.createdAt) - dateValue(right.createdAt);
      case "orders":
        return left.orders - right.orders;
      case "amount":
        return left.amount - right.amount;
      case "status":
        return (left.status?.label ?? "").localeCompare(right.status?.label ?? "", language);
      default:
        return 0;
    }
  };
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => compare(left.row, right.row) * factor || left.index - right.index)
    .map(({ row }) => row);
};

/* ─── API javobi ──────────────────────────────────────────────────────────── */

/** `post/new`, `post/rejected` …: `{ data: [] }` yoki `{ data: { data: [] } }` — ikkalasi ham (v1 dagidek). */
export const readMailItems = (payload: unknown): MailItem[] => {
  const response = payload as { data?: unknown } | null | undefined;
  const data = response?.data as { data?: unknown } | unknown[] | null | undefined;
  if (Array.isArray(data)) return data as MailItem[];
  if (data && Array.isArray((data as { data?: unknown }).data)) return (data as { data: MailItem[] }).data;
  return [];
};

const extractOrderItems = (payload: unknown): OrderListItem[] => {
  const response = payload as
    | OrderListItem[]
    | {
        data?: OrderListItem[] | { items?: OrderListItem[]; data?: OrderListItem[] };
        items?: OrderListItem[];
      };

  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (!Array.isArray(response?.data) && Array.isArray(response?.data?.items)) return response.data.items;
  if (!Array.isArray(response?.data) && Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.items)) return response.items;

  return [];
};

/**
 * Menejer zaxirasi: `post?status=sent&branch_id` bo'sh qaytsa, filialga yo'lda kelayotgan buyurtmalar
 * (`orders?status=on the road&branch_id`) pochta bo'yicha guruhlanadi — v1 (`todaysMails.tsx`) dagi AYNAN.
 */
export const buildFallbackMailsFromOrders = (orders: OrderListItem[]): MailItem[] => {
  const groups = new Map<string, MailItem>();

  orders.forEach((order) => {
    const postId = String(order.post_id ?? "").trim();
    if (!postId || order.status !== "on the road") return;

    const regionId = String(order.region_id ?? order.district?.region?.id ?? order.branch?.id ?? "branch");
    const existing = groups.get(postId);

    if (existing) {
      existing.order_quantity += 1;
      existing.post_total_price += Number(order.total_price ?? 0);
      if (order.createdAt && order.createdAt < existing.createdAt) {
        existing.createdAt = order.createdAt;
      }
      return;
    }

    groups.set(postId, {
      id: postId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      courier_id: "",
      post_total_price: Number(order.total_price ?? 0),
      order_quantity: 1,
      qr_code_token: "",
      region_id: regionId,
      region: {
        id: regionId,
        name: order.district?.region?.name ?? order.branch?.name ?? "Filial",
        sato_code: "",
      },
      status: "sent",
    });
  });

  return Array.from(groups.values());
};

/* ─── Hooklar ─────────────────────────────────────────────────────────────── */

/** Ro'yxat so'rovi holati (`QueryBoundary` ga to'g'ridan-to'g'ri beriladi). */
export type MailsListQuery = {
  data: MailItem[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
};

export type MailsListResult = {
  isCourier: boolean;
  /** Yuklangan pochtalar (yuklanmagan — bo'sh massiv). */
  mails: MailItem[];
  /** Yuklanganmi (son ko'rsatish uchun: yuklanmaguncha son chizilmaydi). */
  isLoaded: boolean;
  query: MailsListQuery;
};

/**
 * «Bugungi» pochtalar — v1 (`todaysMails.tsx`) mantig'i so'zma-so'z:
 *  - kuryer — `post/on-the-road` (`useGetNewMailsCourier`), qolganlar — `useGetNewMails`
 *    (menejerda `post?status=sent&branch_id`, boshqalarda `post/new`);
 *  - menejerda zaxira: API bo'sh bo'lsa `orders?status=on the road&branch_id` dan guruhlangan pochtalar.
 */
export const useTodayMails = (): MailsListResult => {
  const role = useSelector((state: RootState) => state.role.role);
  const branchId = useSelector(getCurrentBranchId);
  const isCourier = role === "courier";
  const isManager = role === "manager";
  const { useGetNewMails, useGetNewMailsCourier } = useMails();

  const courierQuery = useGetNewMailsCourier({ enabled: isCourier });
  const defaultQuery = useGetNewMails({ enabled: !isCourier });
  const main = isCourier ? courierQuery : defaultQuery;

  const fallbackOrdersQuery = useQuery({
    queryKey: ["mails", "today-fallback-orders", role, branchId],
    queryFn: () =>
      api
        .get(API_ENDPOINTS.ORDERS.BASE, {
          params: {
            page: 1,
            limit: 100,
            status: "on the road",
            ...(branchId ? { branch_id: branchId } : {}),
          },
        })
        .then((res) => res.data),
    enabled: isManager,
    staleTime: 10_000,
  });

  const apiMails = useMemo(() => readMailItems(main.data), [main.data]);
  const fallbackMails = useMemo(
    () => buildFallbackMailsFromOrders(extractOrderItems(fallbackOrdersQuery.data)),
    [fallbackOrdersQuery.data],
  );
  const mails = apiMails.length > 0 ? apiMails : fallbackMails;
  // Menejerda API bo'sh, zaxira hali kelmagan bo'lsa — «bo'sh» deb ko'rsatmaymiz (miltillamasin).
  const waitingFallback = isManager && apiMails.length === 0 && fallbackOrdersQuery.isLoading;
  const isLoaded = main.data !== undefined && !waitingFallback;

  return {
    isCourier,
    mails: isLoaded ? mails : [],
    isLoaded,
    query: {
      data: isLoaded ? mails : undefined,
      isLoading: main.isLoading || (main.data !== undefined && waitingFallback),
      isError: main.isError,
      error: main.error,
      refetch: main.refetch,
    },
  };
};

/** «Rad etilgan» pochtalar: kuryer — `post/courier/rejected`, qolganlar — `post/rejected` (v1 dagidek). */
export const useRefusedMails = (): MailsListResult => {
  const role = useSelector((state: RootState) => state.role.role);
  const isCourier = role === "courier";
  const { useGetRefusedMails, useGetRefusedMailsCourier } = useMails();

  const courierQuery = useGetRefusedMailsCourier({ enabled: isCourier });
  const defaultQuery = useGetRefusedMails({ enabled: !isCourier });
  const main = isCourier ? courierQuery : defaultQuery;
  const mails = useMemo(() => readMailItems(main.data), [main.data]);
  const isLoaded = main.data !== undefined;

  return {
    isCourier,
    mails,
    isLoaded,
    query: {
      data: isLoaded ? mails : undefined,
      isLoading: main.isLoading,
      isError: main.isError,
      error: main.error,
      refetch: main.refetch,
    },
  };
};

/**
 * Qaytarish so'rovlari soni (har so'rov — bitta buyurtma). Faqat xodim qobig'ida chaqiriladi — kuryerda
 * «Qaytarish» tabi yo'q, so'rov ham ketmaydi. Yuklanmaguncha `undefined` (tabda son chizilmaydi).
 */
export const useReturnRequestsCount = (): number | undefined => {
  const { useGetReturnMails } = useMails();
  const { data } = useGetReturnMails();
  return data?.data?.data?.length;
};
