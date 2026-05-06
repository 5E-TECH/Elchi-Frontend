import { memo, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw, Store } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import type { RootState } from "../../app/config/store";
import HeaderName from "../../shared/components/headerName";
import Pagination from "../../shared/components/pagination";
import { Table } from "../../shared/components/Table/Table";
import type { ColumnConfig } from "../../shared/components/Table/Table.types";
import FilterSelect from "../../shared/ui/FilterSelect";
import FilterPanel from "../../shared/ui/FilterPanel";
import FilterFieldCard from "../../shared/ui/FilterFieldCard";
import FilterDateInput from "../../shared/ui/FilterDateInput";
import PageStatBadge from "../../shared/ui/PageStatBadge";
import EmptyState from "../../shared/ui/EmptyState";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { getCurrentBranchId } from "../../shared/lib/currentBranch";
import { usePagination } from "../../shared/lib/usePagination";
import type { BatchStatus } from "../../entities/batch";
import {
  batchStatusClass,
  batchStatusLabel,
  batchStatusOptions,
  formatBatchDateTime,
  formatBatchMoney,
} from "../batches/lib/batchFormat";

type UnknownRecord = Record<string, any>;

interface ReturnBatch {
  id: string;
  token: string;
  fromBranch: string;
  toBranch: string;
  ordersCount: number;
  totalPrice: number;
  status: BatchStatus;
  createdAt: string;
}

interface ReturnBatchesResponse {
  data: ReturnBatch[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages?: number;
  };
}

interface ReturnBatchesParams {
  page: number;
  limit: number;
  status?: BatchStatus | "";
  from?: string;
  to?: string;
}

const RETURNS_KEY = "return-batches";

const getPayload = (payload: unknown): UnknownRecord => {
  if (!payload || typeof payload !== "object") return {};
  return payload as UnknownRecord;
};

const unwrapList = (payload: unknown): UnknownRecord[] => {
  const body = getPayload(payload);
  const nestedData = getPayload(body.data);
  const candidates = [
    body.items,
    nestedData.items,
    body.results,
    nestedData.results,
    body.data,
    nestedData.data,
    payload,
  ];

  const list = candidates.find(Array.isArray);
  return (list ?? []) as UnknownRecord[];
};

const getMeta = (payload: unknown, page: number, limit: number, count: number) => {
  const body = getPayload(payload);
  const nestedData = getPayload(body.data);
  const meta = getPayload(body.meta ?? nestedData.meta);

  return {
    page: Number(meta.page ?? body.page ?? nestedData.page ?? page),
    limit: Number(meta.limit ?? body.limit ?? nestedData.limit ?? limit),
    total: Number(meta.total ?? body.total ?? nestedData.total ?? count),
    totalPages: Number(meta.totalPages ?? body.totalPages ?? nestedData.totalPages ?? 1),
  };
};

const normalizeReturnBatch = (item: UnknownRecord): ReturnBatch => {
  const sourceBranch = getPayload(
    item.source_branch ?? item.sourceBranch ?? item.from_branch ?? item.fromBranch,
  );
  const destinationBranch = getPayload(
    item.destination_branch ?? item.destinationBranch ?? item.to_branch ?? item.toBranch,
  );
  const id = String(item.id ?? item._id ?? item.batch_id ?? item.batchId ?? item.token ?? "");
  const rawStatus = String(item.status ?? item.batch_status ?? "new").toLowerCase();
  const status: BatchStatus =
    rawStatus === "pending" || rawStatus === "new"
      ? "new"
      : rawStatus === "sent" || rawStatus === "on_the_way"
        ? "on_the_way"
        : rawStatus === "received"
          ? "received"
          : "cancelled";

  return {
    id,
    token: String(item.qr_code_token ?? item.qrCodeToken ?? item.token ?? id),
    fromBranch: String(
      sourceBranch.name
        ?? item.source_branch_name
        ?? item.sourceBranchName
        ?? item.from_branch_name
        ?? item.fromBranchName
        ?? "—",
    ),
    toBranch: String(
      destinationBranch.name
        ?? item.destination_branch_name
        ?? item.destinationBranchName
        ?? item.to_branch_name
        ?? item.toBranchName
        ?? "—",
    ),
    ordersCount: Number(
      item.order_count ?? item.orderCount ?? item.orders_count ?? item.ordersCount ?? 0,
    ),
    totalPrice: Number(
      item.total_price
        ?? item.totalPrice
        ?? item.amount
        ?? item.total_amount
        ?? item.totalAmount
        ?? 0,
    ),
    status,
    createdAt: String(item.created_at ?? item.createdAt ?? item.sent_at ?? item.sentAt ?? ""),
  };
};

const ReturnsPage = () => {
  const { t } = useTranslation("returns");
  const navigate = useNavigate();
  const branchId = useSelector((state: RootState) => getCurrentBranchId(state));
  const { page, limit, setPage, setLimit } = usePagination({
    key: "returns",
    defaultLimit: 10,
  });
  const [status, setStatus] = useState<BatchStatus | "">("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const params = useMemo<ReturnBatchesParams>(
    () => ({
      page,
      limit,
      status: status || undefined,
      from: fromDate ? `${fromDate}T00:00:00` : undefined,
      to: toDate ? `${toDate}T23:59:59` : undefined,
    }),
    [fromDate, limit, page, status, toDate],
  );

  const { data, isError, isLoading } = useQuery({
    queryKey: [RETURNS_KEY, branchId, params],
    enabled: Boolean(branchId),
    queryFn: async (): Promise<ReturnBatchesResponse> => {
      const response = await api
        .get(API_ENDPOINTS.BRANCHES.RETURN_BATCHES(branchId), { params })
        .then((res) => res.data);
      const list = unwrapList(response).map(normalizeReturnBatch).filter((item) => item.id);

      return {
        data: list,
        meta: getMeta(response, params.page, params.limit, list.length),
      };
    },
    placeholderData: (previous) => previous,
  });

  const columns: ColumnConfig<ReturnBatch>[] = useMemo(
    () => [
      {
        key: "token",
        label: t("columns.id"),
        sortable: true,
        render: (value) => (
          <span className="font-black text-maindark dark:text-white">{String(value)}</span>
        ),
      },
      {
        key: "fromBranch",
        label: t("columns.from"),
        sortable: true,
      },
      {
        key: "toBranch",
        label: t("columns.to"),
        sortable: true,
      },
      {
        key: "ordersCount",
        label: t("columns.ordersCount"),
        sortable: true,
        render: (value) => (
          <span className="font-semibold text-maindark dark:text-white">{Number(value)} ta</span>
        ),
      },
      {
        key: "totalPrice",
        label: t("columns.totalPrice"),
        sortable: true,
        render: (value) => (
          <span className="font-extrabold text-emerald-600 dark:text-emerald-300">
            {formatBatchMoney(Number(value))}
          </span>
        ),
      },
      {
        key: "status",
        label: t("columns.status"),
        sortable: true,
        render: (value) => (
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-extrabold ${
              batchStatusClass[value as BatchStatus]
            }`}
          >
            {batchStatusLabel[value as BatchStatus]}
          </span>
        ),
      },
      {
        key: "createdAt",
        label: t("columns.createdAt"),
        sortable: true,
        render: (value) => formatBatchDateTime(String(value)),
      },
    ],
    [t],
  );

  const total = data?.meta.total ?? 0;

  return (
    <div className="min-h-full rounded-2xl p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <HeaderName
          name={t("title")}
          description={t("description")}
          icon={<RotateCcw />}
        />
        <PageStatBadge icon={<Store size={17} />}>
          {t("totalBatches", { count: total })}
        </PageStatBadge>
      </div>

      <FilterPanel
        className="border-[color:var(--color-border-strong)] shadow-[0_10px_30px_rgba(87,106,219,0.08)] dark:border-[color:var(--color-border-soft)]"
        gridClassName="md:grid-cols-3 xl:grid-cols-4"
      >
        <FilterSelect
          name="return_batch_status"
          label={t("filters.status")}
          value={status}
          onChange={(value) => {
            setStatus(value as BatchStatus | "");
            setPage(1);
          }}
          placeholder={t("filters.allStatuses")}
          options={[...batchStatusOptions]}
        />
        <FilterFieldCard>
          <FilterDateInput
            label={t("filters.from")}
            value={fromDate}
            onChange={(value) => {
              setFromDate(value);
              setPage(1);
            }}
          />
        </FilterFieldCard>
        <FilterFieldCard>
          <FilterDateInput
            label={t("filters.to")}
            value={toDate}
            onChange={(value) => {
              setToDate(value);
              setPage(1);
            }}
          />
        </FilterFieldCard>
      </FilterPanel>

      {!branchId ? (
        <div className="mb-4 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-5 text-center text-sm font-semibold text-amber-700 dark:text-amber-100">
          {t("messages.branchMissing")}
        </div>
      ) : null}

      {isError ? (
        <div className="mb-4 rounded-2xl border border-rose-300/30 bg-rose-500/10 p-5 text-center text-sm font-semibold text-rose-700 dark:text-rose-100">
          {t("messages.loadFailed")}
        </div>
      ) : null}

      <Table
        data={data?.data ?? []}
        columns={columns}
        loading={isLoading}
        keyExtractor={(row) => row.id}
        emptyMessage={t("empty")}
        emptyState={(
          <EmptyState
            icon="↩"
            title={t("empty")}
            description="Hozircha qaytarilgan orderlar topilmadi."
            className="border-0 bg-transparent shadow-none"
          />
        )}
        onRowClick={(row) => navigate(`/batches/${row.id}`)}
      />

      {!isError && data?.meta ? (
        <Pagination
          className="mt-4"
          totalItems={data.meta.total}
          itemsPerPage={data.meta.limit}
          currentPage={data.meta.page}
          onPageChange={setPage}
          onItemsPerPageChange={setLimit}
          pageSizeOptions={[10, 20, 50, 100]}
        />
      ) : null}
    </div>
  );
};

export default memo(ReturnsPage);
