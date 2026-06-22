import { memo, useMemo, useState } from "react";
import {
  CheckCircle2,
  MapPinned,
  Inbox,
  Package,
  RefreshCcw,
} from "lucide-react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMails } from "../../../entities/mails";
import { useBatches, type Batch } from "../../../entities/batch";
import type { RootState } from "../../../app/config/store";
import SearchableSelect from "../../../shared/ui/SearchableSelect";
import { buildRegionFilterOptions } from "./lib/regionFilterOptions";
import Pagination from "../../../shared/components/pagination";
import { usePagination } from "../../../shared/lib/usePagination";
import MailGridCard, { MAIL_CARD_GRID_CLASS, MAIL_CARD_SKELETON_CLASS } from "./MailGridCard";

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

const formatPrice = (price: number): string =>
  price.toLocaleString("uz-UZ") + " so'm";

const getStatusMeta = (status: string) => {
  if (status === "canceled_received" || status === "cancelled") {
    return {
      labelKey: "statusReturned",
      icon: <RefreshCcw size={12} className="text-orange-100" />,
    };
  }

  return {
    labelKey: "statusReceived",
    icon: <CheckCircle2 size={12} className="text-emerald-100" />,
  };
};

const OldMailCard = memo(({ item, mode }: { item: MailItem | BatchMailItem; mode: "mail" | "batch" }) => {
  const { t } = useTranslation("mails");
  const navigate = useNavigate();
  const location = useLocation();
  const status = getStatusMeta(item.status);
  const isBatchCard = mode === "batch";
  const openDetail = () => {
    navigate(`/mails/${item.id}`, {
      state: {
        fromTab: "old",
        view: mode === "batch" ? "old-all-batches" : "old",
        fromSearch: location.search,
      },
    });
  };

  return (
    <MailGridCard
      title={item.region?.name ?? t("regionHashFallback", { id: item.region_id })}
      statusLabel={t(status.labelKey)}
      statusIcon={status.icon}
      leadingIcon={isBatchCard ? <Package size={20} /> : <Inbox size={20} />}
      orders={item.order_quantity}
      amount={formatPrice(item.post_total_price)}
      onOpen={openDetail}
      variant={isBatchCard ? "batch" : "old"}
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
  const selectedBatchId = new URLSearchParams(location.search).get("batch_mode") ?? "";
  const isAllBatchMode = canUseBatchMode && selectedBatchId === "all";
  const { useGetOldMails } = useMails();
  const { page, limit, setPage, setLimit } = usePagination({
    key: "mails",
    defaultLimit: 8,
  });
  const { data, isLoading, isError } = useGetOldMails(
    isCourier,
    { page, limit },
    { enabled: !isAllBatchMode },
  );
  const {
    data: batchData,
    isLoading: isBatchLoading,
    isError: isBatchError,
  } = useBatches(
    isAllBatchMode ? { page, limit, statusRaw: "RECEIVED" } : undefined,
    { enabled: isAllBatchMode },
  );
  const [selectedRegionId, setSelectedRegionId] = useState("");

  const mails: MailItem[] = useMemo(() => data?.data?.data ?? [], [data]);
  const pagination = data?.data;
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
  const batchPagination = batchData?.meta;

  const regionOptions = useMemo(
    () =>
      isAllBatchMode
        ? buildRegionFilterOptions(batchItems)
        : buildRegionFilterOptions(mails),
    [isAllBatchMode, batchItems, mails],
  );
  const filteredMails = useMemo(
    () =>
      (isAllBatchMode ? batchItems : mails).filter((mail) => {
      const regionMatched = selectedRegionId ? mail.region?.id === selectedRegionId : true;
      return regionMatched;
      }),
    [isAllBatchMode, batchItems, mails, selectedRegionId],
  );

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
          <p className="text-sm font-semibold text-white dark:text-white">
            {t("oldRegionFilterTitle")}
          </p>
          <p className="text-xs text-white/60 dark:text-white/55">
            {t("oldRegionFilterHint")}
          </p>
        </div>

        <div className="w-full sm:w-72">
          <SearchableSelect
            label={t("oldRegionFilterLabel")}
            name="old-mails-region-filter"
            value={selectedRegionId}
            onChange={setSelectedRegionId}
            options={regionOptions}
            placeholder={t("oldRegionFilterPlaceholder")}
            icon={MapPinned}
            hideLabel
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
            {filteredMails.map((mail) => (
              <OldMailCard key={mail.id} item={mail} mode={isAllBatchMode ? "batch" : "mail"} />
            ))}
          </div>

          {!selectedRegionId && (isAllBatchMode ? batchPagination : pagination) ? (
            <Pagination
              totalItems={(isAllBatchMode ? batchPagination?.total : pagination?.total) ?? 0}
              itemsPerPage={(isAllBatchMode ? batchPagination?.limit : pagination?.limit) ?? limit}
              currentPage={(isAllBatchMode ? batchPagination?.page : pagination?.page) ?? page}
              onPageChange={setPage}
              onItemsPerPageChange={setLimit}
              pageSizeOptions={[8, 16, 32, 64]}
            />
          ) : null}
        </div>
      )}
    </div>
  );
};

export default memo(OldMails);
