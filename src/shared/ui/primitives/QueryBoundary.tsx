import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "../../lib/cx";
import { EmptyState, type StateSize } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { SkeletonChart, SkeletonLines, SkeletonList, SkeletonTable, SlowLoadingHint } from "./SkeletonPresets";
import { SKELETON_DELAY_MS, SLOW_LOADING_MS, useDelayedFlag, useLoadingPhase } from "./useLoadingPhase";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  SO'ROV HOLATLARI CHEGARASI — dizayn v2, 3-bosqich
 *  Taxtalar: `tizim-loading` (kutish zinapoyasi, skeletlar, fon yangilanishi), `tizim-errors` 02
 *  («Har bir ro'yxat va kartada to'rt holat majburiy: yuklanmoqda, bo'sh, natija yo'q, xato»)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Bitta so'rovning to'rt holatini bir joyda chizadi — faqat ma'lumot turgan joy almashadi:
 *
 *    yuklanmoqda — 0–400 ms hech narsa ko'rinmaydi (joy band, miltillash yo'q), keyin skelet
 *                  (`aria-busy` + «Yuklanmoqda…»), 15 s dan keyin «Kutish uzoq davom etmoqda…»;
 *    xato        — ma'lumot yo'q va so'rov yiqildi: `ErrorState` (`error` dan tur, «Qayta urinish» → `refetch`);
 *                  so'rov oflayn kutib turibdi (`isPaused`) — «Internet aloqasi yo'q» (bo'sh holat EMAS);
 *    bo'sh       — `isEmpty(data)` (sukut: bo'sh massiv yoki `{ data: [] }`): `EmptyState` / `empty`;
 *    tayyor      — `children(data, { isRefetching })`.
 *
 *  Fon yangilanishi (filtr, tab, sahifa almashdi; «Yangilash»): ro'yxat yashirilmaydi va sakramaydi —
 *  oldingi ma'lumot qoladi (`keepPreviousData`, sukut), skelet chiqmaydi. `isRefetching` 400 ms dan
 *  keyin `true` bo'ladi — sarlavha yonidagi «Yangilanmoqda…» belgisi yoki grafikda `opacity-45` uchun.
 *  Ma'lumot bor paytda yiqilgan qayta so'rov ro'yxatni xato bilan almashtirmaydi (global xabar aytadi).
 */

/** `useQuery` natijasi yoki oddiy ob'ekt (`{ data, isLoading, isError, error, refetch }`). */
export type QueryLike<TData> = {
  data?: TData | null;
  isLoading?: boolean;
  isPending?: boolean;
  isFetching?: boolean;
  /**
   * So'rov internet yo'qligi sababli kutib turibdi (React Query `networkMode: "online"`, brauzer oflayn):
   * `isPending`, lekin `isFetching` emas. Ma'lumot yo'q bo'lsa — «Internet aloqasi yo'q», «Ma'lumot yo'q» emas.
   */
  isPaused?: boolean;
  isError?: boolean;
  error?: unknown;
  refetch?: () => unknown;
};

export type QueryBoundaryState = {
  /** Fonda yangilanmoqda (400 ms dan uzoq) — ekrandagi ma'lumot eski bo'lishi mumkin. */
  isRefetching: boolean;
  /** Ko'rsatilayotgan ma'lumot oldingi so'rovniki (kalit almashdi, yangisi hali kelmadi). */
  isPreviousData: boolean;
};

export type QueryBoundarySkeleton = "lines" | "table" | "list" | "chart";

export type QueryBoundaryProps<TData> = {
  query: QueryLike<TData>;
  /** Tayyor holat: element yoki `(data, state) => element`. */
  children: ReactNode | ((data: NonNullable<TData>, state: QueryBoundaryState) => ReactNode);
  /** Bo'shmi (sukut: bo'sh massiv yoki `{ data: [] }`). */
  isEmpty?: (data: NonNullable<TData>) => boolean;
  /** Tayyor skelet (sukut `lines`); `loading` berilsa — o'sha. */
  skeleton?: QueryBoundarySkeleton;
  /** O'z skeletingiz (haqiqiy kontent shaklida). */
  loading?: ReactNode;
  /** Bo'sh holat (sukut — «Ma'lumot yo'q»). Filtr natija bermasa — o'zingiz bering («Filtrlarni tozalash»). */
  empty?: ReactNode;
  /** Xato holati: element yoki `(error, retry) => element` (sukut — `ErrorState`). */
  error?: ReactNode | ((error: unknown, retry: () => void) => ReactNode);
  /** Sukut bo'sh/xato holatlari o'lchami (`card` · `page` · `chart`). */
  size?: StateSize;
  /** Ekran o'quvchi uchun yuklanish matni (sukut «Yuklanmoqda…»): «Buyurtmalar yuklanmoqda». */
  loadingLabel?: string;
  /** Skelet kechikishi, ms (sukut 400). */
  delay?: number;
  /** «Kutish uzoq davom etmoqda» vaqti, ms (sukut 15 000); `false` — chiqmaydi. */
  slowAfter?: number | false;
  /** Kalit almashganda oldingi ma'lumotni ko'rsatib turish (sukut `true`). */
  keepPreviousData?: boolean;
  /** O'ram klassi (o'ram har holatda bitta `div`: `data-query-state`, `aria-busy`). */
  className?: string;
};

const defaultIsEmpty = (data: unknown) => {
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === "object" && data !== null && "data" in data) {
    const inner = (data as { data?: unknown }).data;
    return Array.isArray(inner) && inner.length === 0;
  }
  return false;
};

const PRESET: Record<QueryBoundarySkeleton, (slow: boolean) => ReactNode> = {
  lines: () => <SkeletonLines />,
  table: (slow) => <SkeletonTable slow={slow} />,
  list: () => <SkeletonList />,
  chart: () => <SkeletonChart />,
};

/**
 * Dizayn v2 so'rov holatlari.
 *
 *   <QueryBoundary query={ordersQuery} skeleton="table" empty={<EmptyState icon={ShoppingBag} … />}>
 *     {(page, { isRefetching }) => <OrdersTable rows={page.data} dimmed={isRefetching} />}
 *   </QueryBoundary>
 */
export const QueryBoundary = <TData,>({
  query,
  children,
  isEmpty = defaultIsEmpty,
  skeleton = "lines",
  loading,
  empty,
  error: errorSlot,
  size = "card",
  loadingLabel,
  delay = SKELETON_DELAY_MS,
  slowAfter = SLOW_LOADING_MS,
  keepPreviousData = true,
  className,
}: QueryBoundaryProps<TData>) => {
  const { t } = useTranslation("ui");
  const { data, isError = false, error, isFetching = false, isPaused = false, refetch } = query;
  const hasData = data !== undefined && data !== null;
  const isLoading = query.isLoading ?? (query.isPending === true && isFetching);

  // Oxirgi kelgan ma'lumot (kalit almashganda skelet o'rniga ko'rsatiladi).
  const [previous, setPrevious] = useState<NonNullable<TData> | undefined>(hasData ? (data as NonNullable<TData>) : undefined);
  if (hasData && data !== previous) setPrevious(data as NonNullable<TData>);

  const showingPrevious = !hasData && keepPreviousData && previous !== undefined && (isLoading || isFetching) && !isError;
  const shown = hasData ? (data as NonNullable<TData>) : showingPrevious ? previous : undefined;

  const showLoading = shown === undefined && isLoading && !isError;
  const { visible, slow } = useLoadingPhase(showLoading, { delay, slowAfter });
  const isRefetching = useDelayedFlag(shown !== undefined && (isFetching || showingPrevious), delay);

  const retry = () => {
    void refetch?.();
  };

  let state: "loading" | "error" | "empty" | "ready";
  let content: ReactNode;

  if (shown === undefined && isError) {
    state = "error";
    content =
      typeof errorSlot === "function"
        ? errorSlot(error, retry)
        : (errorSlot ?? <ErrorState error={error} size={size} onRetry={refetch ? retry : undefined} />);
  } else if (shown === undefined && isPaused && !showLoading) {
    // Oflayn: so'rov yuborilmadi, internet qaytganda React Query o'zi davom ettiradi.
    state = "error";
    content = <ErrorState kind="offline" size={size} onRetry={refetch ? retry : undefined} />;
  } else if (showLoading) {
    state = "loading";
    const tableSlowInside = loading == null && skeleton === "table";
    content = (
      <>
        {visible ? <span role="status" className="sr-only">{loadingLabel ?? t("states.loading")}</span> : null}
        <div className={cx(!visible && "invisible")} data-skeleton-visible={visible ? "" : undefined}>
          {loading ?? PRESET[skeleton](slow)}
        </div>
        {slow && !tableSlowInside ? <SlowLoadingHint /> : null}
      </>
    );
  } else if (shown === undefined || isEmpty(shown)) {
    state = "empty";
    content = empty ?? <EmptyState title={t("common.empty")} size={size} />;
  } else {
    state = "ready";
    content =
      typeof children === "function" ? children(shown, { isRefetching, isPreviousData: showingPrevious }) : children;
  }

  return (
    <div
      className={className}
      data-query-state={state}
      aria-busy={state === "loading" || (state === "ready" && isRefetching) ? true : undefined}
    >
      {content}
    </div>
  );
};
