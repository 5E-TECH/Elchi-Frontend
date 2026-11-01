// dizayn-v2: superadmin-integrations-legacy-sources, admin-integrations-legacy-sources
import { memo, useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { Inbox, LayoutGrid, Link, List, ListFilter, Pencil, Plug, Plus, RefreshCw, SearchX, Trash2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMarkets } from "../../../entities/markets";
import {
  CATEGORY_LABEL,
  ROLE_META,
  getIntegrationErrorMessage,
  useDeleteIntegration,
  useGetIntegrations,
  useUpdateIntegration,
  type Integration,
  type IntegrationAuthType,
  type IntegrationCategory,
  type IntegrationParams,
  type IntegrationRole,
} from "../../../entities/integrations";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { notify } from "../../../shared/lib/notify";
import {
  Badge,
  Button,
  Card,
  DataTable,
  DateRange,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  PageHeader,
  Pagination,
  Pressable,
  QueryBoundary,
  SegmentedControl,
  Select,
  SkeletonTable,
  StatusBadge,
  Tabs,
  TextInput,
  useConfirm,
  type DataTableColumn,
  type SelectOption,
  type TabItem,
} from "../../../shared/ui/primitives";
import { SecretInput, Switch } from "../../integrations/ui";
import {
  LEGACY_AUTH_LABEL_KEY,
  LEGACY_AUTH_TYPES,
  buildLegacyAuthUpdate,
  legacyAuthLabelKey,
  toLegacyAuthType,
} from "./legacyAuth";

/**
 * ESKI TASHQI MANBALAR (zaxira sahifa) — maket `*-integrations-legacy-sources`.
 *
 *   PageHeader («Eski sahifa») + «Jadval | Kartalar» + «Kiruvchi posilkalar» + yangilash + «Yangi integratsiya»
 *   Karta: rol tablari → filtrlar (qidiruv · Holat · Sana oralig'i; telefonda «Filtrlar» varaqasi) → jadval
 *   yoki kartalar → sahifalash (URL'da `page` / `limit`).
 *
 * ⚠️ QIDIRUV MAHALLIY: `GET /integrations` da nom bo'yicha qidiruv parametri YO'Q (faqat `status`, `role`,
 * `market_id`, `from_date`, `to_date`). Ilgari matn `market_id` sifatida yuborilardi — nom yozilsa backend hech
 * narsa topmasdi. Endi joriy sahifa nom/slug bo'yicha mahalliy suziladi.
 */

const DEFAULT_LIMIT = 10;
const PAGE_SIZES = [10, 20, 50] as const;
const INTEGRATION_VIEW_MODE_KEY = "elchi_integrations_view_mode";
type IntegrationViewMode = "table" | "cards";
type RoleTab = "all" | IntegrationRole;

type IntegrationEditForm = {
  name: string;
  slug: string;
  /** Oqimda nima qiladi — yetkazuvchi / manba / to'lov / ko'zgu. */
  role: string;
  /** Tizim turi — marketplace / CRM / cargo / to'lov / jadval. */
  category: string;
  base_url: string;
  /** Backend qiymati (`login` | `api_key`); eski `basic`/`bearer`/`none` ochilganda shunga o'giriladi. */
  auth_type: IntegrationAuthType;
  auth_url: string;
  username: string;
  /** Sir — serverdan qaytmaydi (`***`), shuning uchun forma doim bo'sh ochiladi; bo'sh qolsa saqlangani o'zgarmaydi. */
  password: string;
  /** `api_key` — xuddi parol kabi. */
  token: string;
  market_id: string;
  is_active: boolean;
};

type MarketOptionSource = { id?: string | number; name?: string; username?: string | null; phone_number?: string | null };

const getMarketItems = (value: unknown): MarketOptionSource[] => {
  const response = value as { data?: MarketOptionSource[] | { items?: MarketOptionSource[] } };
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.items)) return response.data.items;
  return [];
};

const getInitialEditForm = (integration?: Integration | null): IntegrationEditForm => {
  const credentials = integration?.credentials ?? {};
  return {
    name: integration?.name ?? "",
    slug: integration?.slug ?? "",
    // Eski yozuvlarda maydon yo'q — `carrier`/`cargo` ular uchun to'g'ri standart (migratsiya ham shunday).
    role: integration?.role ?? "carrier",
    category: integration?.category ?? "cargo",
    base_url: integration?.base_url || integration?.api_url || "",
    auth_type: toLegacyAuthType(integration?.auth_type),
    auth_url: integration?.auth_url ?? credentials.auth_url ?? "",
    username: integration?.username ?? credentials.username ?? "",
    password: "",
    token: "",
    market_id: integration?.market_id ? String(integration.market_id) : "",
    is_active: Boolean(integration?.is_active),
  };
};

const readViewMode = (): IntegrationViewMode => {
  try {
    return window.localStorage.getItem(INTEGRATION_VIEW_MODE_KEY) === "cards" ? "cards" : "table";
  } catch {
    return "table";
  }
};

const ExternalOrdersPage = () => {
  const { t, i18n } = useTranslation("integrations");
  const language = i18n.language;
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();

  const [status, setStatus] = useState("");
  /**
   * ROL FILTRI — serverga yuboriladi (`?role=`), mijozda emas: sahifalash to'g'ri ishlashi kerak.
   */
  const [role, setRole] = useState<RoleTab>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Integration | null>(null);
  const [editForm, setEditForm] = useState<IntegrationEditForm>(() => getInitialEditForm());
  const [viewMode, setViewMode] = useState<IntegrationViewMode>(readViewMode);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.max(1, Number(searchParams.get("limit") || DEFAULT_LIMIT));
  const { useGetMarkets } = useMarkets();
  const marketsQuery = useGetMarkets({ status: "active", limit: 100 }, true);

  const params = useMemo<IntegrationParams>(() => {
    const next: IntegrationParams = { page, limit };
    if (status) next.status = status;
    if (role !== "all") next.role = role;
    if (dateFrom) next.from_date = dateFrom;
    if (dateTo) next.to_date = dateTo;
    return next;
  }, [dateFrom, dateTo, limit, page, role, status]);

  const query = useGetIntegrations(params, { silentError: true });
  const deleteIntegration = useDeleteIntegration();
  const updateIntegration = useUpdateIntegration();
  const items = useMemo(() => query.data?.data?.items ?? [], [query.data]);
  const meta = query.data?.data?.meta;
  const currentPage = meta?.page ?? page;
  const currentLimit = meta?.limit ?? limit;
  const total = meta?.total ?? items.length;

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.name?.toLowerCase().includes(q) || item.slug?.toLowerCase().includes(q));
  }, [items, search]);

  const updatePage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(Math.max(1, nextPage)));
    next.set("limit", String(currentLimit));
    setSearchParams(next, { replace: true });
  };

  const updateLimit = (nextLimit: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", "1");
    next.set("limit", String(Math.max(1, nextLimit)));
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    setEditForm(getInitialEditForm(editTarget));
  }, [editTarget]);

  useEffect(() => {
    try {
      window.localStorage.setItem(INTEGRATION_VIEW_MODE_KEY, viewMode);
    } catch {
      /* brauzer xotirasi yopiq — ko'rinish faqat shu sessiyada eslab qolinadi */
    }
  }, [viewMode]);

  const updateEditForm = <K extends keyof IntegrationEditForm>(key: K, value: IntegrationEditForm[K]) =>
    setEditForm((previous) => ({ ...previous, [key]: value }));

  const detailHref = (row: Integration) => `/integrations/sources/${row.id}`;

  const confirmUpdate = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!editTarget || updateIntegration.isPending) return;
    try {
      await updateIntegration.mutateAsync({
        id: editTarget.id,
        payload: {
          name: editForm.name.trim(),
          slug: editForm.slug.trim(),
          type: editTarget.type || "api",
          // ⚠️ `type` TRANSPORT (api/webhook/ftp), `role` esa XULQ — ikkisi boshqa o'lcham va ikkalasi yuboriladi.
          role: editForm.role as IntegrationRole,
          category: editForm.category as IntegrationCategory,
          status: editForm.is_active ? "active" : "inactive",
          base_url: editForm.base_url.trim(),
          ...buildLegacyAuthUpdate(editForm),
          market_id: editForm.market_id || null,
          is_active: editForm.is_active,
        },
      });
      notify.success(t("legacySources.updateSuccess"));
      setEditTarget(null);
    } catch (error) {
      notify.error(
        getIntegrationErrorMessage(error) || (error instanceof Error ? error.message : "") || t("legacySources.updateError"),
      );
    }
  };

  /** O'chirish — tasdiq oynasi orqali (maket: «Integratsiyani o'chirish»). */
  const confirmDelete = async (row: Integration) => {
    await confirm({
      tone: "danger",
      title: t("legacySources.deleteTitle"),
      description: t("legacySources.deleteText", { name: row.name }),
      confirmLabel: t("legacySources.delete"),
      cancelLabel: t("npCancel"),
      icon: Trash2,
      confirmIcon: Trash2,
      onConfirm: async () => {
        try {
          await deleteIntegration.mutateAsync(row.id);
          notify.success(t("legacySources.deleteSuccess"));
        } catch (error) {
          notify.error(getIntegrationErrorMessage(error) || t("legacySources.deleteError"));
        }
      },
    });
  };

  const authLabel = (value?: string | null) => {
    // Backend `AuthType` — `api_key` | `login`; eski forma qiymatlari (`bearer`/`basic`/`none`) ham shu yerda o'qiladi.
    const key = legacyAuthLabelKey(value);
    return key ? t(key) : String(value);
  };
  const lastSync = (value?: string | null) => (value ? formatDateTimeLocalized(value, { language }) : t("legacySources.notSynced"));
  const statusBadge = (active?: boolean) => (
    <StatusBadge tone={active ? "success" : "neutral"} label={active ? t("legacySources.active") : t("legacySources.inactive")} />
  );
  const rowActions = (row: Integration) => (
    <div className="flex items-center justify-end gap-1">
      <IconButton size="sm" icon={Pencil} label={t("legacySources.editAria", { name: row.name })} onClick={() => setEditTarget(row)} />
      <IconButton
        size="sm"
        variant="danger"
        icon={Trash2}
        label={t("legacySources.deleteAria", { name: row.name })}
        onClick={() => void confirmDelete(row)}
      />
    </div>
  );
  const nameLink = (row: Integration) => (
    <Pressable
      onClick={() => navigate(detailHref(row))}
      // Telefonda (kartalar) bosiladigan balandlik 44 px.
      className="text-left font-semibold text-text hover:text-action-fg hover:underline max-md:inline-flex max-md:min-h-11 max-md:items-center"
    >
      {row.name}
    </Pressable>
  );

  const columns: DataTableColumn<Integration>[] = [
    {
      id: "name",
      header: t("legacySources.colIntegration"),
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          {nameLink(row)}
          <span className="truncate text-xs text-text-muted max-lg:hidden">{row.slug || t("legacySources.idLabel", { id: row.id })}</span>
          <span className="max-w-[280px] truncate text-xs text-text-muted lg:hidden">{row.api_url || row.base_url || "—"}</span>
        </div>
      ),
    },
    {
      id: "url",
      header: t("legacySources.apiUrl"),
      hideBelow: "lg",
      cell: (row) => (
        <span className="flex min-w-0 max-w-[320px] items-center gap-1.5 text-[13px]">
          <Link size={14} aria-hidden="true" className="flex-none text-text-muted" />
          <span className="truncate">{row.api_url || row.base_url || "—"}</span>
        </span>
      ),
    },
    {
      id: "auth",
      header: t("legacySources.colAuth"),
      hideBelow: "lg",
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <span>{authLabel(row.auth_type)}</span>
          {row.username ? <span className="truncate text-xs text-text-muted">{row.username}</span> : null}
        </div>
      ),
    },
    {
      id: "sync",
      header: t("legacySources.colLastSync"),
      cell: (row) => <span className={cx("whitespace-nowrap", !row.last_sync_at && "text-text-muted")}>{lastSync(row.last_sync_at)}</span>,
    },
    { id: "status", header: t("colStatus"), cell: (row) => statusBadge(row.is_active) },
    { id: "actions", header: <span className="sr-only">{t("console.colActions")}</span>, align: "end", cell: rowActions },
  ];

  const statusOptions: SelectOption[] = [
    { value: "", label: t("legacySources.all") },
    { value: "active", label: t("legacySources.active") },
    { value: "inactive", label: t("legacySources.inactive") },
  ];

  const roleTabs: TabItem<RoleTab>[] = [
    { value: "all", label: t("legacySources.all") },
    ...(Object.keys(ROLE_META) as IntegrationRole[]).map((key) => ({
      value: key,
      label: t(ROLE_META[key].labelKey),
      title: t(ROLE_META[key].hintKey),
    })),
  ];

  const marketOptions = useMemo<SelectOption[]>(
    () =>
      getMarketItems(marketsQuery.data).map((market) => ({
        value: String(market.id ?? ""),
        label: `${market.name ?? "—"}${
          market.phone_number ? ` · ${formatPhone(market.phone_number)}` : market.username ? ` · ${market.username}` : ""
        }`,
      })),
    [marketsQuery.data],
  );
  const authOptions: SelectOption<IntegrationAuthType>[] = LEGACY_AUTH_TYPES.map((value) => ({
    value,
    label: t(LEGACY_AUTH_LABEL_KEY[value]),
  }));
  const roleOptions: SelectOption[] = (Object.keys(ROLE_META) as IntegrationRole[]).map((key) => ({ value: key, label: t(ROLE_META[key].labelKey) }));
  const categoryOptions: SelectOption[] = (Object.keys(CATEGORY_LABEL) as IntegrationCategory[]).map((key) => ({
    value: key,
    label: t(CATEGORY_LABEL[key]),
  }));

  const activeFilters = (status ? 1 : 0) + (dateFrom || dateTo ? 1 : 0);
  const statusField = (
    <Field label={t("legacySources.statusFilterAria")} hideLabel labelAs="span" className="min-w-0 flex-[1_1_200px] max-md:basis-full">
      <Select
        options={statusOptions}
        value={status || null}
        onChange={(value) => {
          setStatus(value ?? "");
          updatePage(1);
        }}
        inlineLabel={t("colStatus")}
        placeholder={t("legacySources.all")}
      />
    </Field>
  );
  const dateField = (
    <Field label={t("legacySources.dateRange")} hideLabel labelAs="span" className="min-w-0 flex-[1_1_240px] max-md:basis-full">
      <DateRange
        value={{ from: dateFrom, to: dateTo }}
        onChange={({ from, to }) => {
          setDateFrom(from);
          setDateTo(to);
          updatePage(1);
        }}
        placeholder={t("legacySources.dateRange")}
        months={1}
      />
    </Field>
  );

  const cardKeyDown = (row: Integration) => (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigate(detailHref(row));
    }
  };

  const listContent = (list: Integration[], isRefetching: boolean) =>
    viewMode === "cards" ? (
      <div
        role="list"
        aria-label={t("legacySources.listAria")}
        aria-busy={isRefetching || undefined}
        className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-4 border-t border-border p-5 max-md:p-4"
      >
        {list.map((item) => (
          <div key={item.id} role="listitem" className="flex min-w-0">
            <div
              role="link"
              tabIndex={0}
              aria-label={item.name}
              onClick={(event) => {
                if ((event.target as Element).closest("button")) return;
                navigate(detailHref(item));
              }}
              onKeyDown={cardKeyDown(item)}
              className="flex w-full min-w-0 cursor-pointer flex-col gap-3 rounded-[14px] border border-border bg-surface p-4 transition-[background-color] duration-150 hover:bg-row-hover motion-reduce:transition-none"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex size-9 flex-none items-center justify-center rounded-[10px] bg-sunken text-text-muted">
                    <Plug size={18} aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold text-text">{item.name}</span>
                    <span className="truncate text-xs text-text-muted">{item.slug || t("legacySources.idLabel", { id: item.id })}</span>
                  </span>
                </span>
                {statusBadge(item.is_active)}
              </div>
              <span className="flex flex-wrap gap-1.5">
                <Badge title={t(ROLE_META[item.role ?? "carrier"]?.hintKey ?? "")}>{t(ROLE_META[item.role ?? "carrier"]?.labelKey ?? "")}</Badge>
                {item.category && item.category !== "other" ? <Badge>{t(CATEGORY_LABEL[item.category])}</Badge> : null}
              </span>
              <dl className="grid grid-cols-[minmax(110px,40%)_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                <dt className="text-text-muted">{t("legacySources.apiUrl")}</dt>
                <dd className="m-0 min-w-0 truncate font-mono">{item.api_url || item.base_url || "—"}</dd>
                <dt className="text-text-muted">{t("legacySources.colAuth")}</dt>
                <dd className="m-0 min-w-0 truncate">
                  {authLabel(item.auth_type)}
                  {item.username ? ` · ${item.username}` : ""}
                </dd>
                <dt className="text-text-muted">{t("legacySources.colLastSync")}</dt>
                <dd className="m-0">{lastSync(item.last_sync_at)}</dd>
                <dt className="text-text-muted">{t("legacySources.market")}</dt>
                <dd className="m-0 min-w-0 truncate">{item.market?.name || item.market_id || "—"}</dd>
              </dl>
              <div className="mt-auto flex justify-end">{rowActions(item)}</div>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <DataTable
        rows={list}
        columns={columns}
        getRowKey={(row) => row.id}
        label={t("legacySources.listAria")}
        density="tablet-tight"
        onRowClick={(row) => navigate(detailHref(row))}
        busy={isRefetching}
        className="border-t border-border"
        renderCard={(row) => (
          <div className="flex min-w-0 items-start gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                {nameLink(row)}
                {statusBadge(row.is_active)}
              </span>
              <span className="text-xs text-text-muted [overflow-wrap:anywhere]">{row.api_url || row.base_url || "—"}</span>
              <span className="text-xs text-text-muted">
                {authLabel(row.auth_type)} · {lastSync(row.last_sync_at)}
              </span>
            </div>
            <div className="flex flex-none gap-1">
              <IconButton icon={Pencil} label={t("legacySources.editAria", { name: row.name })} onClick={() => setEditTarget(row)} />
              <IconButton variant="danger" icon={Trash2} label={t("legacySources.deleteAria", { name: row.name })} onClick={() => void confirmDelete(row)} />
            </div>
          </div>
        )}
      />
    );

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        back="/integrations"
        backLabel={t("pageTitle")}
        title={t("legacySources.title")}
        meta={<Badge title={t("legacySources.legacyHint")}>{t("legacySources.legacyBadge")}</Badge>}
        description={t("legacySources.subtitle")}
        actions={
          <>
            <SegmentedControl
              options={[
                { value: "table", label: t("legacySources.viewTable"), icon: List },
                { value: "cards", label: t("legacySources.viewCards"), icon: LayoutGrid },
              ]}
              value={viewMode}
              onValueChange={setViewMode}
              ariaLabel={t("legacySources.viewAria")}
              className="max-md:hidden"
            />
            {/*
              Kiruvchi posilkalarni skanerlab qabul qilish — kunlik operatsiya, `/new-orders/incoming` (kanonik yo'l).
            */}
            <Button variant="secondary" leftIcon={Inbox} onClick={() => navigate("/new-orders/incoming")}>
              {t("legacySources.incoming")}
            </Button>
            <IconButton
              variant="secondary"
              icon={RefreshCw}
              label={t("refresh")}
              loading={query.isFetching && !query.isLoading}
              onClick={() => void query.refetch()}
            />
            <Button leftIcon={Plus} onClick={() => navigate("/integrations/sources/create")}>
              {t("legacySources.create")}
            </Button>
          </>
        }
      />

      <Card
        padding="none"
        aria-label={t("legacySources.listAria")}
        footer={
          total > 0 ? (
            <Pagination
              page={currentPage}
              pageSize={currentLimit}
              total={total}
              onPageChange={updatePage}
              onPageSizeChange={updateLimit}
              pageSizeOptions={PAGE_SIZES}
              summary={(range) => t("legacySources.range", range)}
            />
          ) : undefined
        }
      >
        <Tabs
          items={roleTabs}
          value={role}
          onValueChange={(next) => {
            setRole(next);
            updatePage(1);
          }}
          ariaLabel={t("legacySources.roleTabsAria")}
          listClassName="px-3"
        />
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 max-md:px-4">
          <TextInput
            mode="search"
            value={search}
            onValueChange={setSearch}
            placeholder={t("legacySources.searchPlaceholder")}
            aria-label={t("legacySources.searchAria")}
            className="min-w-0 flex-[1_1_280px]"
          />
          <div className="contents max-md:hidden">
            {statusField}
            {dateField}
          </div>
          <Button
            variant="secondary"
            leftIcon={ListFilter}
            onClick={() => setFiltersOpen(true)}
            className="md:hidden max-md:w-full"
            aria-label={t("legacySources.filtersAria")}
          >
            {t("legacySources.filters")}
            {activeFilters ? <Badge tone="info" size="sm">{formatNumberLocalized(activeFilters, { language })}</Badge> : null}
          </Button>
        </div>
        <QueryBoundary
          query={{ data: query.data ? shown : undefined, isLoading: query.isLoading, isError: query.isError, error: query.error, refetch: query.refetch }}
          loading={
            <SkeletonTable
              framed={false}
              rows={5}
              columns={[t("legacySources.colIntegration"), t("legacySources.colLastSync"), t("colStatus")]}
              className="border-t border-border"
            />
          }
          empty={
            search.trim() || activeFilters || role !== "all" ? (
              <EmptyState className="border-t border-border" icon={SearchX} title={t("legacySources.notFound")} />
            ) : (
              <EmptyState
                className="border-t border-border"
                icon={Plug}
                title={t("legacySources.empty")}
                action={
                  <Button variant="secondary" leftIcon={Plus} onClick={() => navigate("/integrations/sources/create")}>
                    {t("legacySources.create")}
                  </Button>
                }
              />
            )
          }
          error={(error, retry) => (
            <ErrorState
              className="border-t border-border"
              error={error}
              title={t("legacySources.loadListError")}
              description={getIntegrationErrorMessage(error) || undefined}
              onRetry={retry}
            />
          )}
        >
          {(list, { isRefetching }) => listContent(list, isRefetching)}
        </QueryBoundary>
      </Card>

      {/* ═══ Telefon: filtrlar varaqasi (Holat · Sana oralig'i) ═══ */}
      <Dialog
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={t("legacySources.filters")}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setStatus("");
                setDateFrom("");
                setDateTo("");
                updatePage(1);
              }}
            >
              {t("legacySources.clear")}
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>{t("legacySources.showResults")}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {statusField}
          {dateField}
        </div>
      </Dialog>

      {/* ═══ Tahrirlash ═══ */}
      <Dialog
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        busy={updateIntegration.isPending}
        title={t("legacySources.editTitle")}
        icon={Pencil}
        size="xl"
        onSubmit={(event) => void confirmUpdate(event)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditTarget(null)} disabled={updateIntegration.isPending}>
              {t("npCancel")}
            </Button>
            <Button type="submit" loading={updateIntegration.isPending}>
              {t("console.save")}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={t("legacySources.name")}>
            <TextInput value={editForm.name} onValueChange={(v) => updateEditForm("name", v)} placeholder={t("legacySources.namePlaceholder")} />
          </Field>
          <Field label={t("legacySources.slug")}>
            <TextInput value={editForm.slug} onValueChange={(v) => updateEditForm("slug", v)} placeholder={t("legacySources.slugPlaceholder")} />
          </Field>
          {/* ROL va KATEGORIYA — `type` (api/webhook/ftp) faqat transport, «qanday gaplashamiz». */}
          <Field label={t("fRoleLabel")} labelAs="span" hint={t(ROLE_META[(editForm.role as IntegrationRole) ?? "carrier"]?.hintKey ?? "")}>
            <Select options={roleOptions} value={editForm.role || null} onChange={(v) => updateEditForm("role", v ?? "carrier")} />
          </Field>
          <Field label={t("fCategoryLabel")} labelAs="span" hint={t("legacySources.categoryHint")}>
            <Select options={categoryOptions} value={editForm.category || null} onChange={(v) => updateEditForm("category", v ?? "other")} />
          </Field>
          <Field label={t("legacySources.apiUrl")} className="md:col-span-2">
            <TextInput type="url" inputMode="url" value={editForm.base_url} onValueChange={(v) => updateEditForm("base_url", v)} placeholder="https://api.example.com/orders" />
          </Field>
          <Field label={t("legacySources.authType")} labelAs="span">
            <Select
              options={authOptions}
              value={editForm.auth_type}
              onChange={(v) => {
                updateEditForm("auth_type", v ?? "login");
                if (v !== "api_key") updateEditForm("token", "");
              }}
            />
          </Field>
          <div className="flex items-end">
            <Switch
              checked={editForm.is_active}
              onChange={(next) => updateEditForm("is_active", next)}
              aria-label={t("legacySources.activeAria")}
              label={editForm.is_active ? t("legacySources.active") : t("legacySources.inactive")}
              description={editForm.is_active ? t("legacySources.activeHint") : t("legacySources.inactiveHint")}
            />
          </div>
          <Field label={t("legacySources.authUrl")} hint={t("legacySources.optional")} className="md:col-span-2">
            <TextInput type="url" inputMode="url" value={editForm.auth_url} onValueChange={(v) => updateEditForm("auth_url", v)} placeholder="https://api.example.com/auth" />
          </Field>
          {editForm.auth_type === "login" ? (
            <>
              <Field label={t("legacySources.username")}>
                <TextInput value={editForm.username} onValueChange={(v) => updateEditForm("username", v)} placeholder={t("legacySources.usernamePlaceholder")} autoComplete="off" />
              </Field>
              <Field label={t("legacySources.password")} hint={t("fApiKeyHint")}>
                <SecretInput value={editForm.password} onValueChange={(v) => updateEditForm("password", v)} placeholder={t("legacySources.passwordPlaceholder")} />
              </Field>
            </>
          ) : null}
          {editForm.auth_type === "api_key" ? (
            <Field label={t("legacySources.token")} hint={t("fApiKeyHint")} className="md:col-span-2">
              <SecretInput value={editForm.token} onValueChange={(v) => updateEditForm("token", v)} placeholder={t("legacySources.tokenPlaceholder")} />
            </Field>
          ) : null}
          <Field label={t("legacySources.market")} labelAs="span" className="md:col-span-2">
            <Select
              searchable
              clearable
              options={marketOptions}
              value={editForm.market_id || null}
              onChange={(v) => updateEditForm("market_id", v ?? "")}
              loading={marketsQuery.isLoading}
              placeholder={t("legacySources.selectMarket")}
            />
          </Field>
        </div>
      </Dialog>
    </div>
  );
};

export default memo(ExternalOrdersPage);
