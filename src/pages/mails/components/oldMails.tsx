// dizayn-v2: superadmin-mails-old, superadmin-mails-old-batches, admin-mails-old, admin-mails-old-all-batches, manager-mails-old, registrator-mails-old, courier-mails-old
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck, Download, Inbox, ListFilter, MapPin, Package, Printer, User, X } from "lucide-react";
import { useSelector } from "react-redux";
import { useLocation, useSearchParams } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import type { RootState } from "../../../app/config/store";
import { useMails, type PostOrder } from "../../../entities/mails";
import {
  BATCH_KEY,
  BATCH_STATUS_TONE,
  fetchAllTransferBatches,
  type Batch,
  type BatchStatus,
} from "../../../entities/batch";
import { useUser } from "../../../entities/user/api/userApi";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import { usePagination } from "../../../shared/lib/usePagination";
import {
  Button,
  Card,
  DateRange,
  EmptyState,
  ErrorState,
  IconButton,
  Pagination,
  QueryBoundary,
  SegmentedControl,
  Select,
  SkeletonTable,
  type SelectOption,
} from "../../../shared/ui/primitives";
import { formatDay, formatRangeShort } from "../../../shared/ui/primitives/date/calendarMath";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import { formatBatchDisplayId } from "../../batches/lib/batchFormat";
import { printOrders } from "../detail/lib/printMode";
import type { MailsTabLayout } from "../model/mailsLayout";
import {
  buildOldMailsQuery,
  clearOldMailsFilters,
  countOldMailsFilters,
  effectiveOldMailsStatus,
  fetchAllOldMailPages,
  filterOldBatches,
  getOldMailDate,
  getOldMailStatusBadge,
  OLD_BATCH_STATUS_FILTERS,
  OLD_MAIL_STATUS_FILTERS,
  OLD_MAIL_STATUS_FILTERS_COURIER,
  OLD_MAILS_BATCH_MODE_ALL,
  OLD_MAILS_BATCH_MODE_KEY,
  OLD_MAILS_PAGE_MAX,
  readOldMailsFilters,
  readOldMailsPage,
  readPostOrders,
  summarizeOldMails,
  toOldMailSourceFromBatch,
  writeOldMailsFilters,
  writeOldMailsMode,
  type OldMailSource,
  type OldMailStatusKind,
  type OldMailsFilters,
} from "../model/oldMailsModel";
import { buildRegionFilterOptions } from "./lib/regionFilterOptions";
import { exportOldMailsToExcel } from "./lib/exportOldMailsToExcel";
import { MailsTable, type MailsTableRow } from "./MailsTable";
import { OldMailsFiltersSheet } from "./OldMailsFiltersSheet";

/**
 * «Pochta → Eski» (`/mails/old`) — dizayn v2. Maketlar: `admin-mails-old` / `superadmin-mails-old`,
 * `manager-mails-old`, `registrator-mails-old`, `courier-mails-old`; «Filial paketlari» rejimi —
 * `admin-mails-old-all-batches` / `superadmin-mails-old-batches`.
 *
 *  - Xodim (`layout="card"`, qobiq kartasi ichida): asboblar qatori — «Pochtalar | Filial paketlari» segmenti
 *    (faqat admin va superadmin, `?batch_mode=all`, D11), xulosa (D6), «Excelga yuklash» (D5); filtrlar qatori —
 *    yorliqli `Select` lar (D4) va sana oralig'i; jadval; sahifalash.
 *    Telefonda: «Filtrlar N» → pastki varaqa (`OldMailsFiltersSheet`), faol filtr chiplari, Excel — ikonka.
 *  - Kuryer (`layout="page"`): o'z kartasi; filtrlar — sana, viloyat, holat (kuryer filtri yo'q, holatda
 *    «Jo'natilgan» yo'q); jadval saralanadi (faqat joriy sahifa — endpointda saralash parametri yo'q); telefonda
 *    sana va «Filtrlar» karta ustida, «Jami N ta pochta» + «Excelga yuklash».
 *
 * Pochtalar (F4, backend YfrqN70i): filtr va sahifalash SERVERDA — `GET /post` / `post/courier/old-posts` URL
 * filtrlari, `page`, `limit` (≤ 100) va `has_orders=true` bilan (`buildOldMailsQuery`); sahifalash javobdagi
 * `total` bo'yicha; xulosa — faqat «N ta pochta» (API buyurtma/summa yig'indisini bermaydi); Excel — barcha
 * filtrlangan qatorlar, 100 talab sahifalab (`fetchAllOldMailPages`).
 * «Filial paketlari»: `GET transfer-batches` da viloyat va sana oralig'i yo'q — BARCHA sahifalar yuklanadi
 * (`fetchAllTransferBatches`), filtr, xulosa, sahifalash va Excel mijoz tomonida.
 */

const PAGE_SIZES = [8, 16, 32, 64] as const;

type OldMailRow = MailsTableRow & {
  regionId: string;
  isBatch: boolean;
  /** Pochta holati turi (paketda — `null`). Chekni qayta chiqarish — faqat «qabul qilingan» pochtada. */
  kind: OldMailStatusKind | null;
};

type ToRegion = { id: string | number; name?: string };

const toItems = <T extends { id: string | number; name?: string }>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== "object" || value === null) return [];

  const record = value as {
    data?: { items?: T[]; data?: T[] };
    items?: T[];
  };

  if (Array.isArray(record.data?.items)) return record.data.items;
  if (Array.isArray(record.data?.data)) return record.data.data;
  if (Array.isArray(record.items)) return record.items;
  return [];
};

/** `.el-tab-count` + `action-soft` (maket: «Filtrlar 1»). */
const COUNT_PILL =
  "inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-action-soft px-1.5 text-xs font-semibold text-action-fg";

/** `.el-chip.el-chip-active` (CODE-MAP 2.2); telefonda 44 px. */
const CHIP =
  "inline-flex h-8 max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-action " +
  "bg-action-soft pl-3 pr-1 text-[13px] font-semibold text-action-fg max-md:h-11 max-md:pr-0";
const CHIP_X =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-action-fg " +
  "transition-[background-color] duration-150 motion-reduce:transition-none hover:bg-action/15 " +
  "max-md:-ml-2.5 max-md:size-11";

/** Maketdagi filtr maydoni: `flex: 1 1 calc(300px - 10%)` — desktopda 4 tasi bir qatorda, planshetda 2 tadan. */
const FILTER_ITEM = "min-w-0 flex-[1_1_calc(300px_-_10%)]";

const STRONG = <span className="font-semibold text-text" />;

type OldMailsProps = {
  /** Qobiq kontrakti (`model/mailsLayout.ts`); berilmasa — rolga qarab (kuryer — `page`). */
  layout?: MailsTabLayout;
};

const OldMails = ({ layout }: OldMailsProps) => {
  const { t, i18n } = useTranslation(["mailsArchive", "mails", "mailsShell", "newOrders", "ui", "payments"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const count = (value: number) => formatNumberLocalized(value, { language });
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const { role } = useSelector((state: RootState) => state.role);
  const isCourier = role === "courier";
  const isManager = role === "manager";
  const resolvedLayout: MailsTabLayout = layout ?? (isCourier ? "page" : "card");
  const isPhone = useIsPhone();
  const canUseBatchMode = role === "admin" || role === "superadmin";
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedBatchMode = searchParams.get(OLD_MAILS_BATCH_MODE_KEY) ?? "";
  const isAllBatchMode = canUseBatchMode && selectedBatchMode === OLD_MAILS_BATCH_MODE_ALL;
  const withCourier = !isCourier && !isAllBatchMode;
  const { useGetOldMails, fetchOldMails } = useMails();
  const { useGetRegions, useGetCouriers } = useUser();
  const { page, limit, setPage, setLimit } = usePagination({
    key: "mails",
    defaultLimit: PAGE_SIZES[0],
  });

  // URL — yagona manba. Kuryerda kuryer filtri yo'q (ekranda ham, so'rovda ham), «Jo'natilgan» holati ham yo'q
  // (`post/courier/old-posts` unga bo'sh sahifa beradi).
  const urlFilters = useMemo(() => readOldMailsFilters(searchParams), [searchParams]);
  const filters = useMemo<OldMailsFilters>(
    () =>
      isCourier
        ? { ...urlFilters, courierId: "", status: effectiveOldMailsStatus(urlFilters.status, false, { courier: true }) }
        : urlFilters,
    [isCourier, urlFilters],
  );

  // Pochtalar: bitta server sahifasi (filtrlar, `page`, `limit` ≤ 100, `has_orders`); sahifa almashganda oldingi
  // sahifa xiralashib turadi (`keepPreviousData`).
  const listQuery = useMemo(
    () => buildOldMailsQuery({ filters, page, limit, isCourier }),
    [filters, isCourier, limit, page],
  );
  const mailsQuery = useGetOldMails(isCourier, listQuery, { enabled: !isAllBatchMode, keepPreviousData: true });
  // Paketlar: barcha sahifalar (kalit `BATCH_KEY` ostida — paket amallaridan keyingi yangilanish shuni ham oladi).
  const batchesQuery = useQuery({
    queryKey: [BATCH_KEY, "all-pages"],
    queryFn: () => fetchAllTransferBatches(),
    enabled: isAllBatchMode,
  });
  const { data: regionsData, isLoading: regionsLoading } = useGetRegions(true);
  const { data: couriersData, isLoading: couriersLoading } = useGetCouriers(
    { status: "active", limit: 100 },
    !isCourier,
  );

  /* ─── Ma'lumot ──────────────────────────────────────────────────────────── */

  const mailsPage = useMemo(() => readOldMailsPage<OldMailSource>(mailsQuery.data), [mailsQuery.data]);
  const batchItems = useMemo<OldMailSource[]>(
    () => (batchesQuery.data?.data ?? []).map((batch: Batch) => toOldMailSourceFromBatch(batch)),
    [batchesQuery.data],
  );
  const sources = isAllBatchMode ? batchItems : mailsPage.rows;
  // Mijoz tomonidagi filtr va xulosa — faqat paketlar rejimida (pochtalarni server filtrlaydi).
  const filteredBatches = useMemo(
    () => (isAllBatchMode ? filterOldBatches(batchItems, filters) : []),
    [batchItems, filters, isAllBatchMode],
  );
  const batchTotals = useMemo(() => summarizeOldMails(filteredBatches), [filteredBatches]);
  /** Filtrlangan jami: pochtalarda server `total`, paketlarda mijoz hisobi. */
  const listTotal = isAllBatchMode ? filteredBatches.length : mailsPage.total;

  /* ─── Filtr variantlari ─────────────────────────────────────────────────── */

  const regionOptions = useMemo<SelectOption[]>(() => {
    const regionItems = toItems<ToRegion>(regionsData);
    if (regionItems.length) {
      return regionItems.map((region) => ({ value: String(region.id), label: region.name ?? String(region.id) }));
    }
    return buildRegionFilterOptions(sources);
  }, [regionsData, sources]);

  const courierOptions = useMemo<SelectOption[]>(
    () =>
      toItems<{ id: string | number; name?: string }>(couriersData)
        .filter((courier) => courier.name)
        .map((courier) => ({ value: String(courier.id), label: courier.name ?? String(courier.id) })),
    [couriersData],
  );

  const statusOptions = useMemo<SelectOption[]>(
    () =>
      isAllBatchMode
        ? OLD_BATCH_STATUS_FILTERS.map((status) => ({ value: status, label: t(`newOrders:batchStatus.${status}`) }))
        : (isCourier ? OLD_MAIL_STATUS_FILTERS_COURIER : OLD_MAIL_STATUS_FILTERS).map((option) => ({
            value: option.value,
            label: t(`mails:${option.labelKey}`),
          })),
    [isAllBatchMode, isCourier, t],
  );

  /* ─── URL yozish ────────────────────────────────────────────────────────── */

  const updateFilters = useCallback(
    (patch: Partial<OldMailsFilters>) =>
      setSearchParams((prev) => writeOldMailsFilters(prev, patch), { replace: true }),
    [setSearchParams],
  );
  const resetFilters = useCallback(
    () => setSearchParams((prev) => clearOldMailsFilters(prev), { replace: true }),
    [setSearchParams],
  );
  const setBatchMode = useCallback(
    (batches: boolean) => setSearchParams((prev) => writeOldMailsMode(prev, batches), { replace: true }),
    [setSearchParams],
  );

  /* ─── Sahifalash (pochtalar — server, paketlar — mijoz tomonida) ───────── */

  // Pochtalarda server bitta sahifada ≤ 100 beradi — qo'lda yozilgan `?limit=500` da ham sahifalash bir xil.
  const pageSize = isAllBatchMode ? limit : Math.min(limit, OLD_MAILS_PAGE_MAX);

  const visible = useMemo(
    () => (isAllBatchMode ? filteredBatches.slice((page - 1) * limit, page * limit) : mailsPage.rows),
    [filteredBatches, isAllBatchMode, limit, mailsPage.rows, page],
  );

  // URL'dagi sahifa oxirgisidan katta bo'lsa — oxirgisiga. Faqat haqiqiy (eski sahifa emas) javob bo'yicha.
  const lastPage = isAllBatchMode ? Math.max(1, Math.ceil(filteredBatches.length / limit)) : mailsPage.totalPages;
  const settled = isAllBatchMode
    ? batchesQuery.data != null
    : mailsQuery.data != null && !mailsQuery.isPlaceholderData;
  useEffect(() => {
    if (settled && page > lastPage) {
      setPage(lastPage);
    }
  }, [lastPage, page, setPage, settled]);

  /* ─── Qatorlar ──────────────────────────────────────────────────────────── */

  const regionNameOf = useCallback(
    (mail: OldMailSource) => mail.region?.name ?? t("mails:regionHashFallback", { id: mail.region_id }),
    [t],
  );

  const toRow = useCallback(
    (mail: OldMailSource): OldMailRow => {
      const id = String(mail.id);
      if (isAllBatchMode) {
        const status = mail.status as BatchStatus;
        const tone = BATCH_STATUS_TONE[status];
        return {
          id,
          displayId: formatBatchDisplayId(id),
          createdAt: getOldMailDate(mail),
          regionId: String(mail.region?.id ?? mail.region_id ?? ""),
          regionName: regionNameOf(mail),
          courierName: null,
          orders: Number(mail.order_quantity) || 0,
          amount: Number(mail.post_total_price) || 0,
          status: tone ? { tone, label: t(`newOrders:batchStatus.${status}`) } : null,
          isBatch: true,
          kind: null,
        };
      }
      const badge = getOldMailStatusBadge(mail.status);
      return {
        id,
        displayId: `№${id}`,
        createdAt: getOldMailDate(mail),
        regionId: String(mail.region?.id ?? mail.region_id ?? ""),
        regionName: regionNameOf(mail),
        courierName: mail.courier?.name?.trim() || null,
        orders: Number(mail.order_quantity) || 0,
        amount: Number(mail.post_total_price) || 0,
        status: { tone: badge.tone, label: t(`mails:${badge.labelKey}`) },
        isBatch: false,
        kind: badge.kind,
      };
    },
    [isAllBatchMode, regionNameOf, t],
  );

  const rows = useMemo(() => visible.map(toRow), [toRow, visible]);

  // Tafsilotga: holat bilan (orqaga — shu tab va filtrlar; v1 dagidek). Paket qatori — paket sahifasi
  // `/batches/:id` («← Eski pochtalar» filtrlar bilan, `resolveBatchBack`): v1 dagi `/mails/:id`
  // (`view: "old-all-batches"`) paket id'si bilan pochta so'rardi va doim bo'sh chiqardi.
  const linkOf = useCallback(
    (row: OldMailRow) =>
      row.isBatch
        ? { to: `/batches/${row.id}`, state: { from: "mails-old", fromSearch: location.search } }
        : { to: `/mails/${row.id}`, state: { fromTab: "old", view: "old", fromSearch: location.search } },
    [location.search],
  );

  const openLabel = useCallback(
    (row: OldMailRow) =>
      row.isBatch
        ? t("old.openBatch", { id: row.displayId })
        : t(isCourier ? "old.openMailCourier" : "old.openMail", { id: row.id }),
    [isCourier, t],
  );

  /* ─── Chekni qayta chiqarish ────────────────────────────────────────────── */

  const [printingId, setPrintingId] = useState<string | null>(null);
  const printingRef = useRef(false);
  const handleReprint = useCallback(
    async (row: OldMailRow) => {
      // Qayta bosish himoyasi: chek tayyorlanayotganda boshqa so'rov ketmaydi.
      if (row.isBatch || printingRef.current) return;
      printingRef.current = true;
      setPrintingId(row.id);
      try {
        const response = await api.get(API_ENDPOINTS.POSTS.ORDERS_BY_POST_ID(row.id));
        const orders = readPostOrders<PostOrder>(response.data);

        if (orders.length === 0) {
          notify.warning(t("mails:emptyOrders"));
          return;
        }

        printOrders("browser", orders);
      } catch {
        notify.error(t("mails:reprintReceiptError"));
      } finally {
        printingRef.current = false;
        setPrintingId(null);
      }
    },
    [t],
  );

  // Telefon kartasi: paketda «Paket B-129 · 14 ta buyurtma · sana» (maket `*-mails-old-*batches`); menejerda
  // sarlavha «Pochta №X», ostida «Kuryer: … · viloyat» va «N ta buyurtma · sana» (maket `manager-mails-old`).
  const ordersSub = (value: number) => t("mailsShell:table.ordersSub", { count: value, value: count(value) });
  const dateText = (value: string) => formatDateTimeLocalized(value, { language });
  const cardTitle = isManager && !isAllBatchMode ? (row: OldMailRow) => t("mailsShell:mailTitle", { id: row.displayId }) : undefined;
  const cardSub = isAllBatchMode
    ? (row: OldMailRow) => (
        <>
          {t("mailsShell:table.cardId", { header: t("old.colBatch"), id: row.displayId })} · {ordersSub(row.orders)} ·{" "}
          <span className="whitespace-nowrap">{dateText(row.createdAt)}</span>
        </>
      )
    : isManager
      ? (row: OldMailRow) => (
          <>
            {[row.courierName ? t("mails:oldCourierLabel", { name: row.courierName }) : null, row.regionName]
              .filter(Boolean)
              .join(" · ")}
            <br />
            {ordersSub(row.orders)} · <span className="whitespace-nowrap">{dateText(row.createdAt)}</span>
          </>
        )
      : undefined;

  const canReprint = (row: OldMailRow) => !row.isBatch && row.kind === "received";
  const reprintAria = (row: OldMailRow) => t(isCourier ? "old.reprintAriaCourier" : "old.reprintAria", { id: row.id });

  const rowActions = (row: OldMailRow): ReactNode => {
    if (!canReprint(row)) return null;
    if (isCourier) {
      // Kuryer desktopida — matnli kichik tugma (planshetda faqat ikonka).
      return (
        <Button
          variant="secondary"
          size="sm"
          compact
          leftIcon={Printer}
          aria-label={reprintAria(row)}
          title={t("old.reprint")}
          loading={printingId === row.id}
          onClick={() => void handleReprint(row)}
        >
          <span className="max-lg:hidden">{t("old.reprint")}</span>
        </Button>
      );
    }
    return (
      <IconButton
        size="sm"
        icon={Printer}
        label={reprintAria(row)}
        loading={printingId === row.id}
        loadingLabel={t("old.reprintLoading")}
        onClick={() => void handleReprint(row)}
      />
    );
  };

  const cardActions = (row: OldMailRow): ReactNode =>
    canReprint(row) ? (
      <Button
        variant={isCourier ? "secondary" : "ghost"}
        size="sm"
        leftIcon={Printer}
        aria-label={reprintAria(row)}
        loading={printingId === row.id}
        onClick={() => void handleReprint(row)}
        className={isCourier ? undefined : "-mr-2"}
      >
        {t("old.reprint")}
      </Button>
    ) : null;

  /* ─── Excel ─────────────────────────────────────────────────────────────── */

  const exportRows = (items: readonly OldMailSource[]) =>
    exportOldMailsToExcel({
      rows: items.map((mail) => {
        const row = toRow(mail);
        return {
          id: mail.id,
          region: regionNameOf(mail),
          courier: isAllBatchMode ? "" : mail.courier?.name ?? "",
          status: row.status?.label ?? "",
          orders: Number(mail.order_quantity ?? 0),
          amount: Number(mail.post_total_price ?? 0),
          createdAt: getOldMailDate(mail),
        };
      }),
      labels: {
        title: isAllBatchMode ? t("mails:oldBatchExportTitle") : t("mails:oldExportTitle"),
        generatedAt: t("mails:oldExportGeneratedAt"),
        no: t("mails:oldExportNo"),
        mailId: t("mails:mailNumber"),
        region: t("mails:oldRegionFilterLabel"),
        courier: t("mails:courier"),
        status: t("mails:oldStatusFilterLabel"),
        orders: t("mails:ordersLabel"),
        amount: t("mails:amountLabel"),
        date: t("mails:mailDate"),
        totalMails: t("mails:totalMails"),
        totalOrders: t("mails:oldExportTotalOrders"),
        totalAmount: t("mails:oldExportTotalAmount"),
        currency: t("payments:currency"),
      },
    });

  // Pochtalar: BARCHA filtrlangan qatorlar serverdan 100 talab (joriy sahifa emas); paketlar — mijoz filtri.
  // Bir vaqtda bitta yuklash (ref — qayta bosish himoyasi, holat — tugma spinneri).
  const [exporting, setExporting] = useState(false);
  const exportingRef = useRef(false);
  const handleExportExcel = async () => {
    if (exportingRef.current) return;
    exportingRef.current = true;
    setExporting(true);
    try {
      const items: OldMailSource[] = isAllBatchMode
        ? filteredBatches
        : (
            await fetchAllOldMailPages(
              (params) => fetchOldMails(isCourier, params),
              buildOldMailsQuery({ filters, page: 1, limit: OLD_MAILS_PAGE_MAX, isCourier }),
            )
          ).rows;
      exportRows(items);
      notify.success(t("mails:oldExportSuccess", { count: items.length }));
    } catch {
      notify.error(t("old.exportError"));
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  };

  /* ─── Filtrlar: qiymatlar, chiplar ──────────────────────────────────────── */

  const effectiveStatus = effectiveOldMailsStatus(filters.status, isAllBatchMode);
  const activeCount = countOldMailsFilters(filters, { batches: isAllBatchMode, withCourier });
  // Telefonda «Filtrlar N»: kuryerda sana asboblar qatorida — songa kirmaydi.
  const sheetCount = countOldMailsFilters(filters, { batches: isAllBatchMode, withCourier, withDate: !isCourier });
  const all = t("ui:select.all");
  const withAll = (items: readonly SelectOption[]) => [{ value: "", label: all }, ...items];
  const nameOf = (items: readonly SelectOption[], id: string) => items.find((item) => item.value === id)?.label ?? `#${id}`;

  type Chip = { key: string; label: string; removeLabel: string; onRemove: () => void };
  const chips: Chip[] = [];
  const removeLabel = (label: string) => t("ui:filters.remove", { label });
  const chipText = (label: string, value: string) => t("ui:filters.chip", { label, value });
  if (!isCourier && (filters.dateFrom || filters.dateTo)) {
    const range = { from: filters.dateFrom, to: filters.dateTo };
    const value =
      formatRangeShort(range) ??
      (range.from
        ? t("ui:date.fromOnly", { date: formatDay(range.from) })
        : t("ui:date.toOnly", { date: formatDay(range.to) }));
    chips.push({
      key: "date",
      label: chipText(t("old.filters.date"), value),
      removeLabel: removeLabel(t("old.filters.date")),
      onRemove: () => updateFilters({ dateFrom: "", dateTo: "" }),
    });
  }
  if (filters.regionId) {
    chips.push({
      key: "region",
      label: chipText(t("old.filters.region"), nameOf(regionOptions, filters.regionId)),
      removeLabel: removeLabel(t("old.filters.region")),
      onRemove: () => updateFilters({ regionId: "" }),
    });
  }
  if (withCourier && filters.courierId) {
    chips.push({
      key: "courier",
      label: chipText(t("old.filters.courier"), nameOf(courierOptions, filters.courierId)),
      removeLabel: removeLabel(t("old.filters.courier")),
      onRemove: () => updateFilters({ courierId: "" }),
    });
  }
  if (effectiveStatus) {
    chips.push({
      key: "status",
      label: chipText(t("old.filters.status"), nameOf(statusOptions, effectiveStatus)),
      removeLabel: removeLabel(t("old.filters.status")),
      onRemove: () => updateFilters({ status: "" }),
    });
  }

  const [sheetOpen, setSheetOpen] = useState(false);
  const [prevIsPhone, setPrevIsPhone] = useState(isPhone);
  if (prevIsPhone !== isPhone) {
    // Ekran telefondan kattalashsa varaqa yopiladi.
    setPrevIsPhone(isPhone);
    setSheetOpen(false);
  }

  /* ─── Bo'laklar ─────────────────────────────────────────────────────────── */

  const summaryPart = (key: string, value: number, values?: Record<string, unknown>) => (
    <span className="whitespace-nowrap">
      <Trans
        t={t}
        i18nKey={key}
        count={values ? undefined : value}
        values={values ?? { value: count(value) }}
        components={{ strong: STRONG }}
      />
    </span>
  );

  // Xulosa (D6, manager maketi «46 ta pochta · 684 ta buyurtma · jami 128 360 000 so'm»; telefonda 2 qator).
  // Pochtalarda faqat «N ta pochta» — server `total`: API buyurtma/summa yig'indisini bermaydi, bitta sahifadan
  // hisoblash noto'g'ri bo'lardi (ega savoli Q1). Paketlarda — to'liq, barcha yuklangan paketlar bo'yicha.
  const summary = isAllBatchMode ? (
    <p className="text-[13px] leading-[18px] text-text-muted">
      {summaryPart("old.summaryBatches", batchTotals.count)}
      {" · "}
      {summaryPart("old.summaryOrders", batchTotals.orders)}
      {isPhone ? <br /> : " · "}
      {summaryPart("old.summaryTotal", batchTotals.amount, { amount: money(batchTotals.amount) })}
    </p>
  ) : (
    <p className="text-[13px] leading-[18px] text-text-muted">{summaryPart("old.summaryMails", listTotal)}</p>
  );

  const modeSwitch = canUseBatchMode ? (
    <SegmentedControl
      ariaLabel={t("old.viewLabel")}
      options={[
        { value: "mails", label: t("old.viewMails") },
        { value: "batches", label: t("old.viewBatches") },
      ]}
      value={isAllBatchMode ? "batches" : "mails"}
      onValueChange={(value) => setBatchMode(value === "batches")}
    />
  ) : null;

  const query = isAllBatchMode ? batchesQuery : mailsQuery;
  // Umuman bo'sh («Eski pochtalar topilmadi»): pochtalarda — filtrsiz server `total` 0, paketlarda — birorta
  // paket yo'q. Filtr bilan 0 — «Tanlangan filtrlar bo'yicha…» (tozalash tugmasi bilan).
  const emptyAll = isAllBatchMode ? batchItems.length === 0 : mailsPage.total === 0 && activeCount === 0;
  // Ma'lumot keldi va ro'yxat bo'sh emas. Xulosa, sahifalash va Excel faqat shunda: yuklanish, xato va bo'sh
  // holatda «0 ta pochta» chalg'itadi, Excel esa bo'sh fayl berardi (v1 da bu holatlarda asboblar qatori yo'q edi).
  const hasData = query.data != null && listTotal > 0;
  const showSummary = hasData;
  const runExport = () => void handleExportExcel();

  const exportButton = (
    <Button
      variant="secondary"
      compact
      leftIcon={Download}
      disabled={!hasData}
      loading={exporting}
      onClick={runExport}
    >
      {t("old.export")}
    </Button>
  );
  const exportIconButton = (
    <IconButton
      variant="secondary"
      icon={Download}
      label={t("old.export")}
      disabled={!hasData}
      loading={exporting}
      loadingLabel={t("old.exportLoading")}
      onClick={runExport}
    />
  );
  // Ko'rinish breakpointi o'ramda: `Button` ning o'z `inline-flex` i `hidden` ni bosib ketmasin.
  const clearLink = (wrapperClassName?: string) =>
    activeCount > 0 ? (
      <span className={cx("shrink-0", wrapperClassName)}>
        <Button variant="link" size="sm" onClick={resetFilters}>
          {t("ui:filters.clearAll")}
        </Button>
      </span>
    ) : null;

  const regionSelect = (
    <Select
      options={withAll(regionOptions)}
      value={filters.regionId}
      onChange={(next) => updateFilters({ regionId: next ?? "" })}
      placeholder={all}
      inlineLabel={t("old.filters.region")}
      aria-label={t("old.filters.region")}
      icon={MapPin}
      searchable={regionOptions.length > 8}
      loading={regionsLoading}
    />
  );
  const courierSelect = withCourier ? (
    <Select
      options={withAll(courierOptions)}
      value={filters.courierId}
      onChange={(next) => updateFilters({ courierId: next ?? "" })}
      placeholder={all}
      inlineLabel={t("old.filters.courier")}
      aria-label={t("old.filters.courier")}
      icon={User}
      searchable
      loading={couriersLoading}
    />
  ) : null;
  const statusSelect = (
    <Select
      options={withAll(statusOptions)}
      value={effectiveStatus}
      onChange={(next) => updateFilters({ status: next ?? "" })}
      placeholder={all}
      inlineLabel={t("old.filters.status")}
      aria-label={t("old.filters.status")}
      icon={CircleCheck}
    />
  );
  const dateRange = (className?: string, clearable = true) => (
    <DateRange
      value={{ from: filters.dateFrom, to: filters.dateTo }}
      onChange={({ from, to }) => updateFilters({ dateFrom: from, dateTo: to })}
      placeholder={t("old.filters.dateRange")}
      clearable={clearable}
      className={className}
      triggerClassName="whitespace-nowrap"
    />
  );
  // `Select` ildizi o'z o'rami (`className` ichki qutiga tushadi) — flex asosi tashqi o'ramda.
  const filterItem = (node: ReactNode) => (node ? <div className={FILTER_ITEM}>{node}</div> : null);

  const filtersButton = (active: number) => (
    <Button
      variant="secondary"
      leftIcon={ListFilter}
      aria-haspopup="dialog"
      aria-expanded={sheetOpen}
      onClick={() => setSheetOpen(true)}
      className="flex-[1_1_140px] aria-expanded:bg-border!"
    >
      <span className="inline-flex items-center gap-2">
        {t("ui:filters.button")}
        {active > 0 ? <span className={COUNT_PILL}>{count(active)}</span> : null}
      </span>
    </Button>
  );

  const chipsRow = (withClear: boolean) =>
    chips.length > 0 ? (
      <div role="group" aria-label={t("ui:filters.active")} className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => (
          <span key={chip.key} className={CHIP}>
            <span className="min-w-0 truncate">{chip.label}</span>
            <button
              type="button"
              aria-label={chip.removeLabel}
              title={chip.removeLabel}
              onClick={chip.onRemove}
              className={CHIP_X}
            >
              <X aria-hidden="true" size={14} strokeWidth={2.25} />
            </button>
          </span>
        ))}
        {withClear ? clearLink() : null}
      </div>
    ) : null;

  const sheet = isPhone ? (
    <OldMailsFiltersSheet
      open={sheetOpen}
      onClose={() => setSheetOpen(false)}
      initial={{ ...filters, status: effectiveStatus }}
      withDate={!isCourier}
      withCourier={withCourier}
      regionOptions={regionOptions}
      courierOptions={courierOptions}
      statusOptions={statusOptions}
      regionsLoading={regionsLoading}
      couriersLoading={couriersLoading}
      preview={
        isAllBatchMode
          ? { kind: "client", count: (draft) => filterOldBatches(batchItems, draft).length }
          : { kind: "server", isCourier }
      }
      onApply={(draft) => updateFilters(draft)}
    />
  ) : null;

  /* ─── Jadval, holatlar, sahifalash ──────────────────────────────────────── */

  const tableLabel = t(isAllBatchMode ? "old.tableBatches" : "old.tableMails");
  const columnsForSkeleton = [
    t(isAllBatchMode ? "old.colBatch" : "old.colMail"),
    t("old.filters.region"),
    t("old.filters.status"),
    t("mails:ordersLabel"),
    t("mails:amountLabel"),
  ];

  const pagination = (
    <Pagination
      page={page}
      pageSize={pageSize}
      total={listTotal}
      onPageChange={setPage}
      onPageSizeChange={setLimit}
      pageSizeOptions={PAGE_SIZES}
      summary={(range) => t(isAllBatchMode ? "old.paginationBatches" : "old.paginationMails", range)}
    />
  );

  const list = (
    <QueryBoundary
      query={{
        data: query.data,
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        refetch: query.refetch,
      }}
      isEmpty={() => emptyAll}
      loadingLabel={t("old.loading")}
      loading={<SkeletonTable framed={false} rows={8} columns={columnsForSkeleton} />}
      error={(error, retry) => <ErrorState error={error} title={t("old.loadError")} onRetry={retry} />}
      empty={
        <EmptyState
          icon={isAllBatchMode ? Package : Inbox}
          title={t(isAllBatchMode ? "old.emptyBatchesTitle" : "old.emptyMailsTitle")}
          description={t(isAllBatchMode ? "old.emptyBatchesDescription" : "old.emptyMailsDescription")}
        />
      }
    >
      {listTotal === 0 ? (
        <EmptyState
          className="border-t border-border"
          icon={ListFilter}
          title={t("old.filtersEmptyTitle")}
          description={t("old.filtersEmptyDescription")}
          action={
            <Button variant="secondary" onClick={resetFilters}>
              {t("ui:filters.clearAll")}
            </Button>
          }
        />
      ) : (
        <MailsTable<OldMailRow>
          rows={rows}
          ariaLabel={tableLabel}
          idHeader={t(isAllBatchMode ? "old.colBatch" : "old.colMail")}
          statusHeader={canUseBatchMode ? t("old.colStatus") : undefined}
          showCourier={!isCourier && !isAllBatchMode}
          courierCards={isCourier}
          sortable={isCourier}
          statusSortable={isCourier}
          tabletMergeOrders={!isCourier && !isAllBatchMode}
          cardTitle={cardTitle}
          cardSub={cardSub}
          linkOf={linkOf}
          openLabel={openLabel}
          rowActions={isAllBatchMode ? undefined : rowActions}
          cardActions={isAllBatchMode ? undefined : cardActions}
          busy={query.isFetching && !query.isLoading}
          className="border-t border-border"
        />
      )}
    </QueryBoundary>
  );

  const showFooter = hasData;

  /* ─── Kuryer: o'z kartasi ───────────────────────────────────────────────── */

  if (resolvedLayout === "page") {
    return (
      <div className="flex flex-col gap-4">
        {isPhone ? (
          <div role="search" aria-label={t("old.filters.label")} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {dateRange("min-w-[200px] flex-[1_1_200px]", false)}
              {filtersButton(sheetCount)}
            </div>
            {chipsRow(true)}
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] text-text-muted">
                {showSummary ? (
                  <Trans
                    t={t}
                    i18nKey="old.courierTotal"
                    count={listTotal}
                    values={{ value: count(listTotal) }}
                    components={{ strong: STRONG }}
                  />
                ) : null}
              </p>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={Download}
                disabled={!hasData}
                loading={exporting}
                onClick={runExport}
                className="-mr-2"
              >
                {t("old.export")}
              </Button>
            </div>
          </div>
        ) : null}
        <Card padding="none" footer={showFooter ? pagination : undefined}>
          {!isPhone ? (
            <div
              role="search"
              aria-label={t("old.filters.label")}
              className="flex flex-wrap items-center gap-3 px-5 py-4"
            >
              {dateRange(FILTER_ITEM)}
              {filterItem(regionSelect)}
              {filterItem(statusSelect)}
              {activeCount > 0 ? (
                <Button variant="ghost" onClick={resetFilters}>
                  {t("old.filters.clear")}
                </Button>
              ) : null}
              {/* D5: kuryer maketida Excel sarlavha amallarida; sarlavha qobiqda — shu qatorning o'ng chetida. */}
              <div className="ml-auto">{exportButton}</div>
            </div>
          ) : null}
          {list}
        </Card>
        {sheet}
      </div>
    );
  }

  /* ─── Xodim: qobiq kartasi ichida ───────────────────────────────────────── */

  return (
    <>
      {/* Asboblar qatori: segment (admin) · xulosa · Excel. Segment bo'lsa planshetda xulosa keyingi qatorga
          o'tadi (maket: segment va Excel bir qatorda); telefonda segment to'liq enli, xulosa ostida. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 pt-4 max-md:px-4">
        {modeSwitch ? <div className="max-md:w-full">{modeSwitch}</div> : null}
        <div className={cx("min-w-0 flex-1", modeSwitch && "max-lg:order-last max-lg:basis-full")}>
          {showSummary ? summary : null}
        </div>
        {!isPhone ? (
          <div className="ml-auto flex items-center gap-3">
            {clearLink("hidden max-lg:inline-flex")}
            {exportButton}
          </div>
        ) : null}
      </div>

      {isPhone ? (
        <div className="flex flex-col gap-3 px-4 pb-4 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {filtersButton(sheetCount)}
            {exportIconButton}
          </div>
          {chipsRow(true)}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 px-5 pb-4 pt-3">
          {filterItem(regionSelect)}
          {filterItem(courierSelect)}
          {filterItem(statusSelect)}
          {dateRange(FILTER_ITEM)}
          {clearLink("max-lg:hidden")}
        </div>
      )}

      {list}
      {showFooter ? (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
          {pagination}
        </div>
      ) : null}
      {sheet}
    </>
  );
};

export default memo(OldMails);
