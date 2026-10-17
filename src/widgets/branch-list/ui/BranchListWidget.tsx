// dizayn-v2: superadmin-branches-list-tree, superadmin-branches-list-table
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Building2, SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useBranches, type Branch, type BranchParams } from "../../../entities/branch";
import { useDeleteBranchAction } from "../../../features/branch-delete";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { useDebounce } from "../../../shared/lib/useDebounce";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  Pagination,
  QueryBoundary,
  SegmentedControl,
  Select,
  Skeleton,
  SkeletonTable,
  TextInput,
  type SegmentedOption,
  type SelectOption,
} from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import BranchCards from "./BranchCards";
import BranchTable from "./BranchTable";
import BranchTree from "./BranchTree";

export type BranchViewMode = "table" | "card" | "tree";

/** Sahifa hajmlari (e2e `branch-list.*.spec.ts`): jadval 12, kartalar 8; daraxt — bitta so'rovda 100 tagacha. */
const TABLE_PAGE_SIZE = 12;
const CARD_PAGE_SIZE = 8;
const TREE_LIMIT = 100;
const TABLE_PAGE_SIZES = [12, 24, 48, 96] as const;
const CARD_PAGE_SIZES = [8, 16, 32, 64] as const;
const SEARCH_DEBOUNCE_MS = 400;

const pageSizeFor = (mode: BranchViewMode) => (mode === "card" ? CARD_PAGE_SIZE : TABLE_PAGE_SIZE);

interface BranchListWidgetProps {
  viewMode: BranchViewMode;
  onViewModeChange: (mode: BranchViewMode) => void;
  onEdit: (branch: Branch) => void;
  /** Sarlavhadagi asosiy amal («+ Yangi filial») — sahifa beradi (oynani o'zi ochadi). */
  createAction?: ReactNode;
}

/**
 * FILIALLAR RO'YXATI — `/branches` (faqat superadmin), dizayn v2.
 *
 * Maketlar: `superadmin-branches-list-tree` (daraxt), `superadmin-branches-list-table` (jadval / kartalar).
 * Sarlavha «Filiallar» + «Jami {n} ta filial»; amallar: «Daraxt · Jadval · Kartalar» (telefonda karta ichida,
 * filtrlardan keyin) va «+ Yangi filial». Karta: qidiruv «Filial nomi yoki manzil bo'yicha qidirish» (0,4 s
 * kutib) + «Holat: Barchasi» (Faol / Nofaol); o'zgarsa sahifa 1 ga qaytadi. Daraxtda sahifalash yo'q (100 tagacha
 * bitta so'rovda), jadval 12 / kartalar 8 tadan — `Pagination` («1–12 / 13 ta filial» + sahifa hajmi).
 *
 * So'rov: `GET /branches?search&status&page&limit` (`useBranches`). Ko'rinish tanlovini sahifa saqlaydi
 * (`localStorage` «branches-view-mode»). O'chirish — `useDeleteBranchAction` (tasdiq oynasi).
 */
const BranchListWidget = ({ viewMode, onViewModeChange, onEdit, createAction }: BranchListWidgetProps) => {
  const { t, i18n } = useTranslation("branches");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const isPhone = useIsPhone();
  const deleteBranch = useDeleteBranchAction();
  const [searchInput, setSearchInput] = useState("");
  const [params, setParams] = useState<BranchParams>(() => ({
    page: 1,
    limit: pageSizeFor(viewMode),
    search: "",
    status: "",
  }));
  const queryParams = useMemo(
    () => (viewMode === "tree" ? { ...params, page: 1, limit: TREE_LIMIT } : params),
    [params, viewMode],
  );
  // Xato ro'yxat kartasida (`ErrorState`) — global xabar takrorlanmaydi.
  const { data, isLoading, isError, error, refetch } = useBranches(queryParams, true, { silentError: true });
  const total = data?.total;
  const hasFilters = Boolean(params.search) || Boolean(params.status);

  const applySearch = useDebounce((search: string) => {
    setParams((prev) => (prev.search === search ? prev : { ...prev, search, page: 1 }));
  }, SEARCH_DEBOUNCE_MS);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    applySearch(value.trim());
  };

  const handleViewChange = (mode: BranchViewMode) => {
    onViewModeChange(mode);
    setParams((prev) => ({ ...prev, page: 1, limit: pageSizeFor(mode) }));
  };

  const clearFilters = () => {
    setSearchInput("");
    setParams((prev) => ({ ...prev, search: "", status: "", page: 1 }));
  };

  const openBranch = useCallback(
    (branch: Branch) => navigate(`/branches/${encodeURIComponent(branch.id)}`),
    [navigate],
  );
  const removeBranch = useCallback((branch: Branch) => void deleteBranch(branch), [deleteBranch]);

  const statusOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: t("list.allStatuses") },
      { value: "active", label: t("status.active") },
      { value: "inactive", label: t("status.inactive") },
    ],
    [t],
  );
  const viewOptions = useMemo<SegmentedOption<BranchViewMode>[]>(
    () => [
      { value: "tree", label: t("list.treeView") },
      { value: "table", label: t("list.tableView") },
      { value: "card", label: t("list.cardView") },
    ],
    [t],
  );
  const viewSwitch = (
    <SegmentedControl
      ariaLabel={t("v2.list.viewLabel")}
      options={viewOptions}
      value={viewMode}
      onValueChange={handleViewChange}
      fullWidth={isPhone}
    />
  );

  const description =
    total !== undefined ? (
      t("v2.list.total", { count: total, value: formatNumberLocalized(total, { language }) })
    ) : isLoading ? (
      <Skeleton width={120} height={14} className="inline-block align-middle" />
    ) : null;

  const pageSizes = viewMode === "card" ? CARD_PAGE_SIZES : TABLE_PAGE_SIZES;
  const footer =
    viewMode !== "tree" && data && data.total > 0 ? (
      <Pagination
        page={data.page || params.page || 1}
        pageSize={data.limit || params.limit || pageSizeFor(viewMode)}
        total={data.total}
        onPageChange={(page) => setParams((prev) => ({ ...prev, page }))}
        onPageSizeChange={(limit) => setParams((prev) => ({ ...prev, limit, page: 1 }))}
        pageSizeOptions={pageSizes}
        summary={(range) => t("v2.list.pagination", range)}
      />
    ) : undefined;

  const listLabel = viewMode === "tree" ? t("v2.tree.label") : t("v2.list.label");

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader
        title={t("page.title")}
        description={description}
        actions={
          <>
            {isPhone ? null : viewSwitch}
            {createAction}
          </>
        }
      />

      <Card as="section" padding="none" aria-label={listLabel} footer={footer}>
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 max-md:px-4">
          <Field label={t("v2.list.searchLabel")} hideLabel className="min-w-0 flex-[6_1_320px] max-md:basis-full">
            <TextInput
              mode="search"
              value={searchInput}
              onValueChange={handleSearchChange}
              placeholder={t("list.searchPlaceholder")}
            />
          </Field>
          <Field
            label={t("fields.status")}
            hideLabel
            labelAs="span"
            className="min-w-0 flex-[1_1_200px] max-md:basis-full"
          >
            <Select
              options={statusOptions}
              value={params.status || null}
              onChange={(status) =>
                setParams((prev) => ({ ...prev, status: (status ?? "") as BranchParams["status"], page: 1 }))
              }
              placeholder={t("list.allStatuses")}
              inlineLabel={t("fields.status")}
            />
          </Field>
          {isPhone ? <div className="basis-full">{viewSwitch}</div> : null}
        </div>

        <QueryBoundary
          query={{ data: data?.data, isLoading, isError, error, refetch }}
          loadingLabel={t("v2.list.loading")}
          loading={
            <SkeletonTable
              framed={false}
              rows={6}
              columns={[t("v2.columns.branch"), t("v2.columns.type"), t("v2.columns.employees"), t("v2.columns.status")]}
            />
          }
          empty={
            hasFilters ? (
              <EmptyState
                icon={SearchX}
                title={t("v2.list.filteredEmpty")}
                description={t("v2.list.filteredEmptyDescription")}
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    {t("v2.list.clearFilters")}
                  </Button>
                }
              />
            ) : (
              <EmptyState icon={Building2} title={t("list.notFound")} description={t("v2.list.emptyDescription")} />
            )
          }
          error={(queryError, retry) => (
            <ErrorState error={queryError} title={t("v2.list.loadFailed")} onRetry={retry} />
          )}
          className="border-t border-border"
        >
          {(list, { isRefetching }) =>
            viewMode === "table" ? (
              <BranchTable data={list} onEdit={onEdit} onDelete={removeBranch} onOpen={openBranch} busy={isRefetching} />
            ) : viewMode === "card" ? (
              <BranchCards data={list} onEdit={onEdit} onDelete={removeBranch} onOpen={openBranch} busy={isRefetching} />
            ) : (
              <BranchTree data={list} onEdit={onEdit} onDelete={removeBranch} onOpen={openBranch} busy={isRefetching} />
            )
          }
        </QueryBoundary>
      </Card>
    </div>
  );
};

export default BranchListWidget;
