import { memo, type MouseEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarRange,
  Cable,
  Clock3,
  Eye,
  EyeOff,
  KeyRound,
  LayoutGrid,
  Link2,
  List,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Store,
  Trash2,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Table } from "../../../shared/components/Table/Table";
import type { ColumnConfig } from "../../../shared/components/Table/Table.types";
import PopupConfirm from "../../../shared/components/popupConfirm";
import UpdatePopup from "../../../shared/components/popupUpdate";
import FilterDateRange from "../../../shared/ui/FilterDateRange";
import FilterSearch from "../../../shared/ui/FilterSearch";
import FilterSelect from "../../../shared/ui/FilterSelect";
import SearchableSelect from "../../../shared/ui/SearchableSelect";
import Pagination from "../../../shared/components/pagination";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";
import { useMarkets } from "../../../entities/markets";
import {
  getIntegrationErrorMessage,
  type Integration,
  type IntegrationParams,
  useDeleteIntegration,
  useGetIntegrations,
  useUpdateIntegration,
} from "../../../entities/integrations";

const DEFAULT_LIMIT = 10;
const AUTH_TYPES = ["none", "bearer", "basic"] as const;
const INTEGRATION_VIEW_MODE_KEY = "elchi_integrations_view_mode";
const editInputClassName =
  "h-12 w-full rounded-2xl border border-glass-border bg-white/80 px-4 text-sm font-semibold text-maindark outline-none transition focus:border-main dark:bg-maindark/60 dark:text-primary";
const editLabelClassName =
  "text-[11px] font-bold uppercase tracking-[0.16em] text-maindark/50 dark:text-primary/50";
type IntegrationViewMode = "table" | "cards";

type IntegrationEditForm = {
  name: string;
  slug: string;
  base_url: string;
  auth_type: string;
  auth_url: string;
  username: string;
  password: string;
  token: string;
  market_id: string;
  is_active: boolean;
};

type MarketOptionSource = {
  id?: string | number;
  name?: string;
  username?: string | null;
  phone_number?: string | null;
};

const getMarketItems = (value: unknown): MarketOptionSource[] => {
  const response = value as {
    data?: MarketOptionSource[] | { items?: MarketOptionSource[] };
  };

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.data?.items)) {
    return response.data.items;
  }

  return [];
};

const getInitialEditForm = (integration?: Integration | null): IntegrationEditForm => {
  const credentials = integration?.credentials ?? {};
  const authType = integration?.auth_type === "api_key" ? "bearer" : integration?.auth_type || "none";

  return {
    name: integration?.name ?? "",
    slug: integration?.slug ?? "",
    base_url: integration?.base_url || integration?.api_url || "",
    auth_type: authType,
    auth_url: integration?.auth_url ?? credentials.auth_url ?? "",
    username: integration?.username ?? credentials.username ?? "",
    password: credentials.password ?? "",
    token: credentials.token ?? credentials.api_key ?? "",
    market_id: integration?.market_id ? String(integration.market_id) : "",
    is_active: Boolean(integration?.is_active),
  };
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return `${date.toLocaleDateString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })} ${date.toLocaleTimeString("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const getStorageViewMode = (): IntegrationViewMode => {
  if (typeof window === "undefined") return "table";
  return window.localStorage.getItem(INTEGRATION_VIEW_MODE_KEY) === "cards" ? "cards" : "table";
};

const ExternalOrdersPage = () => {
  const { t } = useTranslation(["newOrders", "common"]);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { api: notificationApi } = useAppNotification();

  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Integration | null>(null);
  const [editTarget, setEditTarget] = useState<Integration | null>(null);
  const [editForm, setEditForm] = useState<IntegrationEditForm>(() => getInitialEditForm());
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditToken, setShowEditToken] = useState(false);
  const [viewMode, setViewMode] = useState<IntegrationViewMode>(() => getStorageViewMode());
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.max(1, Number(searchParams.get("limit") || DEFAULT_LIMIT));
  const { getMarkets } = useMarkets();
  const marketsQuery = getMarkets({ status: "active", limit: 100 }, true);

  const params = useMemo<IntegrationParams>(() => {
    const nextParams: IntegrationParams = { page, limit };
    if (status) nextParams.status = status;
    if (search.trim()) nextParams.market_id = search.trim();
    if (dateFrom) nextParams.from_date = dateFrom;
    if (dateTo) nextParams.to_date = dateTo;
    return nextParams;
  }, [dateFrom, dateTo, limit, page, search, status]);

  const query = useGetIntegrations(params);
  const deleteIntegration = useDeleteIntegration();
  const updateIntegration = useUpdateIntegration();
  const items = query.data?.data?.items ?? [];
  const meta = query.data?.data?.meta;
  const currentPage = meta?.page ?? page;
  const currentLimit = meta?.limit ?? limit;
  const total = meta?.total ?? items.length;

  const updatePage = (nextPage: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(Math.max(1, nextPage)));
    nextParams.set("limit", String(currentLimit));
    setSearchParams(nextParams, { replace: true });
  };

  const updateLimit = (nextLimit: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", "1");
    nextParams.set("limit", String(Math.max(1, nextLimit)));
    setSearchParams(nextParams, { replace: true });
  };

  useEffect(() => {
    setEditForm(getInitialEditForm(editTarget));
    setShowEditPassword(false);
    setShowEditToken(false);
  }, [editTarget]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(INTEGRATION_VIEW_MODE_KEY, viewMode);
    }
  }, [viewMode]);

  const updateEditForm = <K extends keyof IntegrationEditForm>(
    key: K,
    value: IntegrationEditForm[K],
  ) => {
    setEditForm((previous) => ({ ...previous, [key]: value }));
  };

  const openEditPopup = (event: MouseEvent<HTMLButtonElement>, row: Integration) => {
    event.stopPropagation();
    setEditTarget(row);
  };

  const openDeleteConfirm = (event: MouseEvent<HTMLButtonElement>, row: Integration) => {
    event.stopPropagation();
    setDeleteTarget(row);
  };

  const confirmUpdate = async () => {
    if (!editTarget) return;

    try {
      const credentials: Record<string, string> = {};
      const authUrl = editForm.auth_url.trim();
      const username = editForm.username.trim();
      const password = editForm.password.trim();
      const token = editForm.token.trim();
      if (authUrl) credentials.auth_url = authUrl;
      if (editForm.auth_type === "basic") {
        if (username) credentials.username = username;
        if (password) credentials.password = password;
      }
      if (editForm.auth_type === "bearer" && token) credentials.token = token;

      await updateIntegration.mutateAsync({
        id: editTarget.id,
        payload: {
          name: editForm.name.trim(),
          slug: editForm.slug.trim(),
          type: editTarget.type || "api",
          status: editForm.is_active ? "active" : "inactive",
          base_url: editForm.base_url.trim(),
          auth_type: editForm.auth_type,
          credentials,
          market_id: editForm.market_id || null,
          is_active: editForm.is_active,
        },
      });
      notificationApi.success({
        message: t("integrationUpdateSuccess"),
        placement: "topRight",
      });
      setEditTarget(null);
    } catch (error) {
      notificationApi.error({
        message:
          getIntegrationErrorMessage(error) ||
          (error instanceof Error ? error.message : "") ||
          t("integrationUpdateError"),
        placement: "topRight",
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteIntegration.mutateAsync(deleteTarget.id);
      notificationApi.success({
        message: t("integrationDeleteSuccess"),
        placement: "topRight",
      });
      setDeleteTarget(null);
    } catch (error) {
      notificationApi.error({
        message: getIntegrationErrorMessage(error) || t("integrationDeleteError"),
        placement: "topRight",
      });
    }
  };

  const getAuthLabel = (value?: string | null) => {
    const normalized = value === "api_key" ? "bearer" : value || "none";
    return AUTH_TYPES.includes(normalized as (typeof AUTH_TYPES)[number])
      ? t(`authTypes.${normalized}`)
      : normalized;
  };

  const renderStatusBadge = (active?: boolean) => (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${
        active
          ? "border-success/25 bg-success/10 text-success"
          : "border-rose-400/25 bg-rose-500/10 text-rose-500 dark:text-rose-300"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-success" : "bg-rose-400"}`} />
      {active ? t("active") : t("inactive")}
    </span>
  );

  const columns = useMemo<ColumnConfig<Integration>[]>(
    () => [
      {
        key: "id",
        label: "#",
        width: "58px",
        render: (_value, _row, index) => (
          <span className="text-xs font-semibold text-maindark/50 dark:text-primary/50">
            {(currentPage - 1) * currentLimit + index + 1}
          </span>
        ),
      },
      {
        key: "name",
        label: t("integration"),
        render: (value, row) => (
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-main/10 text-main dark:bg-main/20 dark:text-primary">
              <Cable size={15} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-maindark dark:text-primary">
                {value}
              </p>
              <p className="mt-0.5 truncate text-xs text-maindark/45 dark:text-primary/45">
                {row.slug || t("idLabel", { id: row.id })}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: "api_url",
        label: t("apiUrl"),
        render: (value, row) => (
          <span className="inline-flex max-w-[320px] items-center gap-2 rounded-full border border-glass-border bg-sidebar/60 px-2.5 py-1 text-sm font-semibold text-maindark dark:bg-maindark/40 dark:text-primary">
            <Link2 size={13} className="shrink-0 text-main" />
            <span className="truncate">{value || row.base_url || "-"}</span>
          </span>
        ),
      },
      {
        key: "auth_type",
        label: t("auth"),
        render: (value, row) => (
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-main/10 text-main dark:bg-main/20 dark:text-primary">
              <KeyRound size={13} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-maindark dark:text-primary">
                {getAuthLabel(String(value || row.auth_type || "none"))}
              </p>
              <p className="truncate text-xs font-medium text-maindark/45 dark:text-primary/50">
                {row.username || row.slug || "-"}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: "last_sync_at",
        label: t("lastSync"),
        render: (value) => (
          <span className="inline-flex min-w-[120px] items-center gap-2 text-sm font-semibold text-maindark dark:text-primary">
            <Clock3 size={14} className="shrink-0 text-maindark/35 dark:text-primary/40" />
            <span className={value ? "truncate" : "truncate text-maindark/45 dark:text-primary/45"}>
              {value ? formatDateTime(value) : t("notSynced")}
            </span>
          </span>
        ),
      },
      {
        key: "status",
        label: t("status"),
        render: (_value, row) => renderStatusBadge(row.is_active),
      },
      {
        key: "id",
        label: t("actions", { ns: "common" }),
        width: "112px",
        render: (_value, row) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(event) => openEditPopup(event, row)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-main/20 bg-main/10 text-main transition hover:border-main/40 hover:bg-main/15 dark:text-primary"
              aria-label={t("editIntegration")}
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              onClick={(event) => openDeleteConfirm(event, row)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-500 transition hover:border-rose-500/40 hover:bg-rose-500/15 dark:text-rose-300"
              aria-label={t("deleteIntegration")}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ),
      },
    ],
    [currentLimit, currentPage, t],
  );

  const statusOptions = useMemo(
    () => [
      { value: "", label: t("all") },
      { value: "active", label: t("active") },
      { value: "inactive", label: t("inactive") },
    ],
    [t],
  );

  const authOptions = useMemo(
    () => AUTH_TYPES.map((value) => ({ value, label: t(`authTypes.${value}`) })),
    [t],
  );

  const marketOptions = useMemo(
    () =>
      getMarketItems(marketsQuery.data).map((market) => ({
        value: String(market.id ?? ""),
        label: `${market.name ?? "-"}${
          market.phone_number ? ` • ${market.phone_number}` : market.username ? ` • ${market.username}` : ""
        }`,
      })),
    [marketsQuery.data],
  );

  return (
    <div className="space-y-4 pb-20 sm:pb-24 md:pb-4">
      <div className="rounded-3xl border border-glass-border bg-white/95 p-4 shadow-sm dark:bg-primarydark sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-maindark dark:text-primary">
              {t("integrationsTitle")}
            </h2>
            <p className="mt-1 text-sm text-maindark/45 dark:text-primary/45">
              {t("integrationsSubtitle")}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
            <div className="inline-flex h-10 items-center rounded-2xl border border-glass-border bg-sidebar/55 p-1 dark:bg-maindark/45">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
                  viewMode === "table"
                    ? "bg-main text-white shadow-lg shadow-main/20"
                    : "text-maindark/55 hover:bg-main/10 hover:text-main dark:text-primary/55 dark:hover:text-primary"
                }`}
                aria-label={t("tableView")}
              >
                <List size={16} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
                  viewMode === "cards"
                    ? "bg-main text-white shadow-lg shadow-main/20"
                    : "text-maindark/55 hover:bg-main/10 hover:text-main dark:text-primary/55 dark:hover:text-primary"
                }`}
                aria-label={t("cardView")}
              >
                <LayoutGrid size={16} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => navigate("/new-orders/integrations/create")}
              className="inline-flex h-10 items-center gap-2 rounded-2xl bg-main px-4 text-sm font-bold text-white shadow-lg shadow-main/20 transition-all hover:bg-main/90 active:scale-[0.98]"
            >
              <Plus size={16} />
              {t("createIntegration")}
            </button>
            <button
              type="button"
              onClick={() => query.refetch()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-glass-border bg-sidebar/50 text-maindark/60 transition-all hover:border-main/30 hover:text-main dark:bg-maindark/40 dark:text-primary/60"
              aria-label={t("refresh", { ns: "common" })}
            >
              <RefreshCw size={15} className={query.isFetching ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="rounded-2xl border border-gray-200 bg-maindark/12 p-3 dark:border-white/10 dark:bg-maindark/70 xl:flex-[1.35]">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-maindark/50 dark:text-primary/45">
              <Search size={12} className="text-main/70" />
              {t("search", { ns: "common" })}
            </div>
            <FilterSearch
              value={search}
              onChange={(value) => {
                setSearch(value);
                updatePage(1);
              }}
              placeholder={t("searchIntegration")}
            />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-maindark/12 p-3 dark:border-white/10 dark:bg-maindark/70 xl:w-72">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-maindark/50 dark:text-primary/45">
              <SlidersHorizontal size={12} className="text-main/70" />
              {t("status")}
            </div>
            <FilterSelect
              name="status"
              label={t("status")}
              value={status}
              onChange={(value) => {
                setStatus(value);
                updatePage(1);
              }}
              options={statusOptions}
              placeholder={t("all")}
              size="sm"
              hideLabel
            />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-maindark/12 p-3 dark:border-white/10 dark:bg-maindark/70 xl:flex-1">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-maindark/50 dark:text-primary/45">
              <CalendarRange size={12} className="text-main/70" />
              {t("dateRange")}
            </div>
            <FilterDateRange
              dateFrom={dateFrom}
              dateTo={dateTo}
              onChangeDateFrom={(value) => {
                setDateFrom(value);
                updatePage(1);
              }}
              onChangeDateTo={(value) => {
                setDateTo(value);
                updatePage(1);
              }}
              className="w-full"
              fromClassName="w-full sm:w-full lg:w-48"
              toClassName="w-full sm:w-full lg:w-48"
              size="sm"
            />
          </div>
        </div>
      </div>

      {query.isError && (
        <div className="flex items-center gap-2 rounded-xl border border-error/20 bg-error/8 px-4 py-3 text-sm text-error">
          <AlertCircle size={16} />
          <span>{getIntegrationErrorMessage(query.error) || t("integrationsLoadError")}</span>
        </div>
      )}

      {items.length === 0 && !query.isLoading ? (
        <div className="rounded-2xl border border-glass-border bg-white p-10 text-center dark:bg-primarydark">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-main/10 text-main">
            <Cable size={24} />
          </div>
          <p className="mt-4 text-sm font-semibold text-maindark dark:text-primary">
            {t("integrationsNotFound")}
          </p>
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {items.map((item) => {
            const url = item.api_url || item.base_url || "-";

            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/new-orders/integrations/${item.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(`/new-orders/integrations/${item.id}`);
                  }
                }}
                className="group flex min-h-[220px] flex-col overflow-hidden rounded-2xl border border-glass-border bg-white/95 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-main/35 hover:shadow-xl hover:shadow-main/10 dark:bg-primarydark"
              >
                <div className="flex items-start justify-between gap-3 border-b border-glass-border bg-sidebar/65 px-4 py-3 dark:bg-maindark/35">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-main/10 text-main dark:bg-main/25 dark:text-primary">
                      <Cable size={18} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold text-maindark dark:text-primary">
                        {item.name}
                      </h3>
                      <p className="truncate text-xs font-semibold text-maindark/45 dark:text-primary/45">
                        {item.slug || t("idLabel", { id: item.id })}
                      </p>
                    </div>
                  </div>
                  {renderStatusBadge(item.is_active)}
                </div>

                <div className="flex flex-1 flex-col gap-3 px-4 py-4">
                  <div className="rounded-2xl border border-glass-border bg-sidebar/55 px-3 py-2.5 dark:bg-maindark/35">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-maindark/45 dark:text-primary/45">
                      <Link2 size={12} className="text-main" />
                      {t("apiUrl")}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-maindark dark:text-primary">
                      {url}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-glass-border bg-sidebar/55 px-3 py-2.5 dark:bg-maindark/35">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-main/10 text-main dark:bg-main/20 dark:text-primary">
                          <KeyRound size={14} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-maindark/45 dark:text-primary/45">
                            {t("auth")}
                          </p>
                          <p className="truncate text-sm font-bold text-maindark dark:text-primary">
                            {getAuthLabel(item.auth_type)}
                          </p>
                          <p className="truncate text-xs text-maindark/45 dark:text-primary/45">
                            {item.username || "-"}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-glass-border bg-sidebar/55 px-3 py-2.5 dark:bg-maindark/35">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-maindark/45 dark:text-primary/45">
                        {t("lastSync")}
                      </p>
                      <p className="mt-1 truncate text-sm font-bold text-maindark dark:text-primary">
                        {formatDateTime(item.last_sync_at)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3 pt-1">
                    <span className="inline-flex min-w-0 items-center gap-2 text-xs font-semibold text-maindark/50 dark:text-primary/45">
                      <Store size={14} className="shrink-0 text-main" />
                      <span className="truncate">{item.market?.name || item.market_id || "-"}</span>
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={(event) => openEditPopup(event, item)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-main/20 bg-main/10 text-main transition hover:border-main/40 hover:bg-main/15 dark:text-primary"
                        aria-label={t("editIntegration")}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => openDeleteConfirm(event, item)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500 transition hover:border-rose-500/40 hover:bg-rose-500/15 dark:text-rose-300"
                        aria-label={t("deleteIntegration")}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Table
          data={items}
          columns={columns}
          loading={query.isLoading}
          keyExtractor={(row) => row.id}
          emptyMessage={t("integrationsNotFound")}
          onRowClick={(row) => navigate(`/new-orders/integrations/${row.id}`)}
          bodyCellClassName="px-4 py-2.5 text-sm"
        />
      )}

      {!query.isLoading && (
        <div className="rounded-2xl border border-glass-border bg-white px-4 py-4 dark:bg-primarydark">
          <Pagination
            totalItems={total}
            itemsPerPage={currentLimit}
            currentPage={currentPage}
            onPageChange={updatePage}
            onItemsPerPageChange={updateLimit}
            className="pt-0"
          />
        </div>
      )}

      <PopupConfirm
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={t("deleteIntegrationTitle")}
        message={t("deleteIntegrationMessage", { name: deleteTarget?.name ?? "" })}
        confirmLabel={t("delete", { ns: "common" })}
        isLoading={deleteIntegration.isPending}
        variant="danger"
      />

      <UpdatePopup
        isOpen={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        onSave={confirmUpdate}
        title={t("editIntegration")}
        icon={<Pencil size={20} />}
        saveLabel={t("save", { ns: "common" })}
        cancelLabel={t("cancel", { ns: "common" })}
        isLoading={updateIntegration.isPending}
        widthClassName="max-w-xl"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className={editLabelClassName}>{t("integrationName")}</span>
            <input
              value={editForm.name}
              onChange={(event) => updateEditForm("name", event.target.value)}
              className={editInputClassName}
              placeholder={t("integrationNamePlaceholder")}
            />
          </label>

          <label className="space-y-2">
            <span className={editLabelClassName}>{t("integrationSlug")}</span>
            <input
              value={editForm.slug}
              onChange={(event) => updateEditForm("slug", event.target.value)}
              className={editInputClassName}
              placeholder={t("integrationSlugPlaceholder")}
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className={editLabelClassName}>{t("apiUrl")}</span>
            <input
              value={editForm.base_url}
              onChange={(event) => updateEditForm("base_url", event.target.value)}
              className={editInputClassName}
              placeholder={t("apiUrlPlaceholder")}
            />
          </label>

          <div className="space-y-2">
            <span className={editLabelClassName}>{t("authType")}</span>
            <FilterSelect
              name="integration_auth_type"
              label={t("authType")}
              value={editForm.auth_type}
              onChange={(value) => {
                updateEditForm("auth_type", value);
                if (value !== "bearer") updateEditForm("token", "");
              }}
              options={authOptions}
              hideLabel
            />
          </div>

          <label className="flex h-full min-h-20 items-center justify-between gap-4 rounded-2xl border border-glass-border bg-white/70 px-4 py-3 dark:bg-maindark/50">
            <span>
              <span className="block text-sm font-bold text-maindark dark:text-primary">
                {t("integrationStatus")}
              </span>
              <span className="mt-1 block text-xs text-maindark/45 dark:text-primary/45">
                {editForm.is_active ? t("integrationActiveHint") : t("integrationInactiveHint")}
              </span>
            </span>
            <button
              type="button"
              onClick={() => updateEditForm("is_active", !editForm.is_active)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                editForm.is_active ? "bg-success" : "bg-white/20"
              }`}
              aria-label={t("activeIntegration")}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                  editForm.is_active ? "left-6" : "left-1"
                }`}
              />
            </button>
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className={editLabelClassName}>{t("authUrl")}</span>
            <input
              value={editForm.auth_url}
              onChange={(event) => updateEditForm("auth_url", event.target.value)}
              className={editInputClassName}
              placeholder={t("authUrlPlaceholder")}
            />
          </label>

          {editForm.auth_type === "basic" && (
            <>
              <label className="space-y-2">
                <span className={editLabelClassName}>{t("username")}</span>
                <input
                  value={editForm.username}
                  onChange={(event) => updateEditForm("username", event.target.value)}
                  className={editInputClassName}
                  placeholder={t("usernamePlaceholder")}
                />
              </label>
              <label className="space-y-2">
                <span className={editLabelClassName}>{t("password")}</span>
                <div className="relative">
                  <input
                    type={showEditPassword ? "text" : "password"}
                    value={editForm.password}
                    onChange={(event) => updateEditForm("password", event.target.value)}
                    className={`${editInputClassName} pr-11`}
                    placeholder={t("passwordPlaceholder")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword((value) => !value)}
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-maindark/50 transition hover:bg-main/10 hover:text-main dark:text-primary/50"
                    aria-label={showEditPassword ? t("hidePassword") : t("showPassword")}
                  >
                    {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
            </>
          )}

          {editForm.auth_type === "bearer" && (
            <label className="space-y-2 md:col-span-2">
              <span className={editLabelClassName}>{t("token")}</span>
              <div className="relative">
                <input
                  type={showEditToken ? "text" : "password"}
                  value={editForm.token}
                  onChange={(event) => updateEditForm("token", event.target.value)}
                  className={`${editInputClassName} pr-11`}
                  placeholder={t("tokenPlaceholder")}
                />
                <button
                  type="button"
                  onClick={() => setShowEditToken((value) => !value)}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-maindark/50 transition hover:bg-main/10 hover:text-main dark:text-primary/50"
                  aria-label={showEditToken ? t("hidePassword") : t("showPassword")}
                >
                  {showEditToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
          )}

          <div className="space-y-2 md:col-span-2">
            <span className={editLabelClassName}>{t("market")}</span>
            <SearchableSelect
              label={t("market")}
              name="integration_market"
              value={editForm.market_id}
              onChange={(value) => updateEditForm("market_id", value)}
              options={marketOptions}
              placeholder={t("selectMarket")}
              icon={KeyRound}
              loading={marketsQuery.isLoading}
              hideLabel
            />
          </div>

        </div>
      </UpdatePopup>
    </div>
  );
};

export default memo(ExternalOrdersPage);
