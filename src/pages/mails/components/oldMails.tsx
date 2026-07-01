import { memo, useEffect, useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Download,
  Filter,
  MapPinned,
  Inbox,
  Package,
  Printer,
  RefreshCcw,
  RotateCcw,
  Send,
  UserRound,
} from "lucide-react";
import { message } from "antd";
import { useSelector } from "react-redux";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMails, type PostOrder } from "../../../entities/mails";
import { useBatches, type Batch } from "../../../entities/batch";
import { useUser } from "../../../entities/user/api/userApi";
import type { RootState } from "../../../app/config/store";
import SearchableSelect from "../../../shared/ui/SearchableSelect";
import { buildRegionFilterOptions } from "./lib/regionFilterOptions";
import Pagination from "../../../shared/components/pagination";
import { usePagination } from "../../../shared/lib/usePagination";
import MailGridCard, { MAIL_CARD_GRID_CLASS, MAIL_CARD_SKELETON_CLASS } from "./MailGridCard";
import FilterDateRange from "../../../shared/ui/FilterDateRange";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import { printOrders } from "../detail/lib/printMode";
import { exportOldMailsToExcel } from "./lib/exportOldMailsToExcel";

interface Region {
  id: string;
  name: string;
  sato_code?: string;
}

interface MailItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  courier_id: string;
  post_total_price: number;
  order_quantity: number;
  qr_code_token: string;
  region_id: string;
  region: Region;
  courier?: {
    id?: string;
    name?: string;
    phone_number?: string;
  } | null;
  status: string;
}

interface BatchMailItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  post_total_price: number;
  order_quantity: number;
  region_id: string;
  region: Region;
  status: string;
}

type OldMailStatusKind = "received" | "cancelled" | "returned" | "sent";

const OLD_MAILS_COLLECTION_LIMIT = 10000;

const formatPrice = (price: number, currencyLabel: string): string =>
  `${price.toLocaleString("uz-UZ")} ${currencyLabel}`;

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

const getMailDate = (mail: MailItem | BatchMailItem) =>
  mail.createdAt || mail.updatedAt || "";

const formatMailDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (item: number) => String(item).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + ` ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const isInDateRange = (mail: MailItem | BatchMailItem, dateFrom: string, dateTo: string) => {
  const value = getMailDate(mail).slice(0, 10);
  if (!value) return true;
  if (dateFrom && value < dateFrom) return false;
  if (dateTo && value > dateTo) return false;
  return true;
};

const normalizeStatus = (status: string) => status.trim().toLowerCase().replaceAll("-", "_");

const hasOrders = (mail: MailItem | BatchMailItem) => Number(mail.order_quantity) > 0;

const isMailItem = (mail: MailItem | BatchMailItem): mail is MailItem =>
  "courier_id" in mail;

const getStatusKind = (status: string): OldMailStatusKind => {
  const normalizedStatus = normalizeStatus(status).replaceAll(" ", "_");

  if (
    normalizedStatus === "canceled_received" ||
    normalizedStatus === "cancelled_received" ||
    normalizedStatus === "returned" ||
    normalizedStatus === "return"
  ) {
    return "returned";
  }

  if (
    normalizedStatus === "canceled" ||
    normalizedStatus === "cancelled" ||
    normalizedStatus === "cancelled_(sent)" ||
    normalizedStatus === "rejected"
  ) {
    return "cancelled";
  }

  if (
    normalizedStatus === "sent" ||
    normalizedStatus === "on_the_way" ||
    normalizedStatus === "on_the_road"
  ) {
    return "sent";
  }

  return "received";
};

const getPostOrders = (value: unknown): PostOrder[] => {
  const response = value as {
    data?: {
      allOrdersByPostId?: PostOrder[];
      orders?: PostOrder[];
      data?: PostOrder[];
    } | PostOrder[];
  };

  if (Array.isArray(value)) return value as PostOrder[];
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.data?.allOrdersByPostId)) return response.data.allOrdersByPostId;
  if (Array.isArray(response.data?.orders)) return response.data.orders;
  if (Array.isArray(response.data?.data)) return response.data.data;
  return [];
};

const getStatusMeta = (status: string) => {
  const statusKind = getStatusKind(status);

  if (statusKind === "cancelled") {
    return {
      kind: statusKind,
      labelKey: "statusRejected",
      icon: <Ban size={12} className="text-rose-100" />,
      badgeClassName: "border-rose-300/20 bg-rose-500 text-white shadow-sm shadow-rose-950/15",
    };
  }

  if (statusKind === "returned") {
    return {
      kind: statusKind,
      labelKey: "statusReturned",
      icon: <RefreshCcw size={12} className="text-orange-100" />,
      badgeClassName: "border-orange-300/20 bg-orange-500 text-white shadow-sm shadow-orange-950/15",
    };
  }

  if (statusKind === "sent") {
    return {
      kind: statusKind,
      labelKey: "statusSent",
      icon: <Send size={12} className="text-blue-100" />,
      badgeClassName: "border-blue-300/20 bg-blue-500 text-white shadow-sm shadow-blue-950/15",
    };
  }

  return {
    kind: statusKind,
    labelKey: "statusReceived",
    icon: <CheckCircle2 size={12} className="text-emerald-100" />,
    badgeClassName: "border-emerald-300/20 bg-emerald-500 text-white shadow-sm shadow-emerald-950/15",
  };
};

const OldMailCard = memo(({ item, mode }: { item: MailItem | BatchMailItem; mode: "mail" | "batch" }) => {
  const { t } = useTranslation("mails");
  const currencyLabel = t("currencyLabel");
  const navigate = useNavigate();
  const location = useLocation();
  const [isPrinting, setIsPrinting] = useState(false);
  const status = getStatusMeta(item.status);
  const isBatchCard = mode === "batch";
  const courierName = "courier" in item ? item.courier?.name : "";
  const createdAt = getMailDate(item);
  const canReprint = !isBatchCard && status.kind === "received";
  const openDetail = () => {
    navigate(`/mails/${item.id}`, {
      state: {
        fromTab: "old",
        view: mode === "batch" ? "old-all-batches" : "old",
        fromSearch: location.search,
      },
    });
  };
  const handleReprint = async () => {
    if (isBatchCard || isPrinting) return;

    try {
      setIsPrinting(true);
      const response = await api.get(API_ENDPOINTS.POSTS.ORDERS_BY_POST_ID(item.id));
      const orders = getPostOrders(response.data);

      if (orders.length === 0) {
        message.warning(t("emptyOrders"));
        return;
      }

      printOrders("browser", orders);
    } catch {
      message.error(t("reprintReceiptError"));
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <MailGridCard
      title={item.region?.name ?? t("regionHashFallback", { id: item.region_id })}
      statusLabel={t(status.labelKey)}
      statusIcon={status.icon}
      leadingIcon={isBatchCard ? <Package size={20} /> : <Inbox size={20} />}
      orders={item.order_quantity}
      amount={formatPrice(item.post_total_price, currencyLabel)}
      onOpen={openDetail}
      variant={isBatchCard ? "batch" : "old"}
      subtitle={courierName ? t("oldCourierLabel", { name: courierName }) : undefined}
      footer={createdAt ? formatMailDate(createdAt) : undefined}
      actionLabel={canReprint ? t("reprintReceipt") : undefined}
      actionIcon={canReprint ? <Printer size={15} /> : undefined}
      actionLoading={isPrinting}
      onAction={canReprint ? handleReprint : undefined}
      statusBadgeClassName={status.badgeClassName}
    />
  );
});
OldMailCard.displayName = "OldMailCard";

const OldMailCardSkeleton = memo(() => (
  <div className={`${MAIL_CARD_SKELETON_CLASS} bg-slate-400/20 dark:bg-white/6`} />
));
OldMailCardSkeleton.displayName = "OldMailCardSkeleton";

const OldMails = () => {
  const { t } = useTranslation("mails");
  const { role } = useSelector((state: RootState) => state.role);
  const isCourier = role === "courier";
  const canUseBatchMode = role === "admin" || role === "superadmin";
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedBatchId = new URLSearchParams(location.search).get("batch_mode") ?? "";
  const isAllBatchMode = canUseBatchMode && selectedBatchId === "all";
  const { useGetOldMails } = useMails();
  const { useGetRegions, useGetCouriers } = useUser();
  const { page, limit, setPage, setLimit } = usePagination({
    key: "mails",
    defaultLimit: 8,
  });
  const selectedRegionId = searchParams.get("region_id") ?? "";
  const selectedCourierId = searchParams.get("courier_id") ?? "";
  const selectedStatus = searchParams.get("status") ?? "";
  const dateFrom = searchParams.get("startDate") ?? "";
  const dateTo = searchParams.get("endDate") ?? "";
  const activeFilterCount = [
    selectedRegionId,
    selectedCourierId,
    selectedStatus,
    dateFrom || dateTo,
  ].filter(Boolean).length;
  const { data, isLoading, isError } = useGetOldMails(
    isCourier,
    {
      page: 1,
      limit: OLD_MAILS_COLLECTION_LIMIT,
      region_id: selectedRegionId,
      courier_id: selectedCourierId,
      status: selectedStatus,
      startDate: dateFrom,
      endDate: dateTo,
    },
    { enabled: !isAllBatchMode },
  );
  const {
    data: batchData,
    isLoading: isBatchLoading,
    isError: isBatchError,
  } = useBatches(
    isAllBatchMode ? { page: 1, limit: OLD_MAILS_COLLECTION_LIMIT } : undefined,
    { enabled: isAllBatchMode },
  );
  const { data: regionsData, isLoading: regionsLoading } = useGetRegions(true);
  const { data: couriersData, isLoading: couriersLoading } = useGetCouriers(
    { status: "active", limit: 100 },
    !isCourier,
  );

  const updateFilter = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      next.set("page", "1");
      return next;
    }, { replace: true });
  };

  const resetFilters = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      ["region_id", "courier_id", "status", "startDate", "endDate", "page"].forEach((key) => {
        next.delete(key);
      });
      return next;
    }, { replace: true });
  };

  const mails: MailItem[] = useMemo(() => data?.data?.data ?? [], [data]);
  const batchItems: BatchMailItem[] = useMemo(
    () =>
      (batchData?.data ?? []).map((batch: Batch) => ({
        id: batch.id,
        createdAt: batch.created_at,
        updatedAt: batch.created_at,
        post_total_price: batch.total_price,
        order_quantity: batch.orders_count,
        region_id: batch.to_branch.id,
        region: {
          id: batch.to_branch.id,
          name: batch.to_branch.region ?? batch.to_branch.name,
        },
        status: batch.status,
      })),
    [batchData],
  );

  const regionOptions = useMemo(() => {
    const regionItems = toItems<Region>(regionsData);
    if (regionItems.length) {
      return regionItems.map((region) => ({
        value: String(region.id),
        label: region.name,
      }));
    }

    return isAllBatchMode
      ? buildRegionFilterOptions(batchItems)
      : buildRegionFilterOptions(mails);
  }, [isAllBatchMode, batchItems, mails, regionsData]);

  const courierOptions = useMemo(
    () =>
      toItems<{ id: string | number; name?: string }>(couriersData)
        .filter((courier) => courier.name)
        .map((courier) => ({
          value: String(courier.id),
          label: courier.name ?? String(courier.id),
        })),
    [couriersData],
  );

  const statusOptions = useMemo(
    () => [
      { value: "sent", label: t("statusSent") },
      { value: "received", label: t("statusReceived") },
      { value: "canceled", label: t("statusRejected") },
      { value: "canceled_received", label: t("statusReturned") },
    ],
    [t],
  );

  const filteredMails = useMemo(
    () =>
      (isAllBatchMode ? batchItems : mails).filter((mail) => {
        const statusMatched = selectedStatus
          ? getStatusKind(mail.status) === getStatusKind(selectedStatus)
          : true;
        const regionMatched = selectedRegionId ? String(mail.region?.id) === selectedRegionId : true;
        const courierMatched =
          selectedCourierId && "courier_id" in mail
            ? String(mail.courier_id) === selectedCourierId
            : true;
        return hasOrders(mail) && regionMatched && courierMatched && statusMatched && isInDateRange(mail, dateFrom, dateTo);
      }),
    [isAllBatchMode, batchItems, mails, selectedRegionId, selectedCourierId, selectedStatus, dateFrom, dateTo],
  );
  const visibleMails = useMemo(
    () => filteredMails.slice((page - 1) * limit, page * limit),
    [filteredMails, limit, page],
  );

  const handleExportExcel = () => {
    exportOldMailsToExcel({
      rows: filteredMails.map((mail) => ({
        id: mail.id,
        region: mail.region?.name ?? t("regionHashFallback", { id: mail.region_id }),
        courier: isMailItem(mail) ? mail.courier?.name ?? "" : "",
        status: t(getStatusMeta(mail.status).labelKey),
        orders: Number(mail.order_quantity ?? 0),
        amount: Number(mail.post_total_price ?? 0),
        createdAt: getMailDate(mail),
      })),
      labels: {
        title: isAllBatchMode ? t("oldBatchExportTitle") : t("oldExportTitle"),
        generatedAt: t("oldExportGeneratedAt"),
        no: t("oldExportNo"),
        mailId: t("mailNumber"),
        region: t("oldRegionFilterLabel"),
        courier: t("courier"),
        status: t("oldStatusFilterLabel"),
        orders: t("ordersLabel"),
        amount: t("amountLabel"),
        date: t("mailDate"),
        totalMails: t("totalMails"),
        totalOrders: t("oldExportTotalOrders"),
        totalAmount: t("oldExportTotalAmount"),
        currency: t("currency", { ns: "payments" }),
      },
    });
    message.success(t("oldExportSuccess", { count: filteredMails.length }));
  };

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredMails.length / limit));
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [filteredMails.length, limit, page, setPage]);

  if (isLoading || (isAllBatchMode && isBatchLoading)) {
    return (
      <div className={MAIL_CARD_GRID_CLASS}>
        {Array.from({ length: 8 }).map((_, index) => (
          <OldMailCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (isError || (isAllBatchMode && isBatchError)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-14 h-14 rounded-2xl bg-main/10 flex items-center justify-center">
          <Inbox size={28} className="text-main" />
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {t("oldLoadError")}
        </p>
      </div>
    );
  }

  if ((isAllBatchMode ? batchItems.length : mails.length) === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-14 h-14 rounded-2xl bg-main/10 flex items-center justify-center">
          <Inbox size={28} className="text-main" />
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {t("emptyOld")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 sm:flex-row sm:items-end sm:justify-between dark:bg-white/3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-main/15 text-main">
              <Filter size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white dark:text-white">
                {t("oldFilterTitle")}
              </p>
              <p className="text-xs text-white/60 dark:text-white/55">
                {t("oldFilterHint")}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-main/40 bg-main px-3 text-sm font-semibold text-white transition hover:bg-main/90"
          >
            <Download size={16} />
            Excel
          </button>
          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/8 px-3 text-sm font-semibold text-white/80 transition hover:bg-white/12"
            >
              <RotateCcw size={15} />
              {t("oldResetFilters")}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 dark:bg-white/3 md:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0">
          <SearchableSelect
            label={t("oldRegionFilterLabel")}
            name="old-mails-region-filter"
            value={selectedRegionId}
            onChange={(value) => updateFilter("region_id", value)}
            options={regionOptions}
            placeholder={t("oldRegionFilterPlaceholder")}
            icon={MapPinned}
            hideLabel
            size="sm"
            loading={regionsLoading}
          />
        </div>

        {!isCourier ? (
          <div className="min-w-0">
            <SearchableSelect
              label={t("oldCourierFilterLabel")}
              name="old-mails-courier-filter"
              value={selectedCourierId}
              onChange={(value) => updateFilter("courier_id", value)}
              options={courierOptions}
              placeholder={t("oldCourierFilterPlaceholder")}
              icon={UserRound}
              hideLabel
              size="sm"
              loading={couriersLoading}
            />
          </div>
        ) : null}

        <div className="min-w-0">
          <SearchableSelect
            label={t("oldStatusFilterLabel")}
            name="old-mails-status-filter"
            value={selectedStatus}
            onChange={(value) => updateFilter("status", value)}
            options={statusOptions}
            placeholder={t("oldStatusFilterPlaceholder")}
            icon={CheckCircle2}
            hideLabel
            size="sm"
          />
        </div>

        <div className="min-w-0">
          <FilterDateRange
            dateFrom={dateFrom}
            dateTo={dateTo}
            onChangeDateFrom={(value) => updateFilter("startDate", value)}
            onChangeDateTo={(value) => updateFilter("endDate", value)}
            placeholder={t("oldDateFilterPlaceholder")}
            size="sm"
          />
        </div>
      </div>

      {filteredMails.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-main/10 flex items-center justify-center">
            <Inbox size={28} className="text-main" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {t("oldFiltersEmpty")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className={MAIL_CARD_GRID_CLASS}>
            {visibleMails.map((mail) => (
              <OldMailCard key={mail.id} item={mail} mode={isAllBatchMode ? "batch" : "mail"} />
            ))}
          </div>

          <Pagination
            totalItems={filteredMails.length}
            itemsPerPage={limit}
            currentPage={page}
            onPageChange={setPage}
            onItemsPerPageChange={setLimit}
            pageSizeOptions={[8, 16, 32, 64]}
          />
        </div>
      )}
    </div>
  );
};

export default memo(OldMails);
