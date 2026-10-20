// dizayn-v2: market-operators-list, market-operators-empty, market-operators-create-dialog, market-operators-commission-dialog, market-operators-commission-fixed-dialog, market-operators-delete-dialog
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleCheck, SearchX, UserPlus, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/config/store";
import {
  useMarketOperators,
  type MarketOperator,
  type MarketOperatorStatus,
} from "../../entities/market-operator";
import { formatNumberLocalized } from "../../shared/lib/formatMoney";
import {
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  Pagination,
  QueryBoundary,
  Select,
  TextInput,
  type SelectOption,
} from "../../shared/ui/primitives";
import { operatorsWithoutCommission } from "./model/unsetCommission";
import { CommissionDialog } from "./ui/CommissionDialog";
import { CommissionWarning } from "./ui/CommissionWarning";
import { CreateOperatorDialog } from "./ui/CreateOperatorDialog";
import { OperatorsSkeleton, OperatorsTable } from "./ui/OperatorsTable";
import { useDeleteOperatorConfirm } from "./ui/useDeleteOperatorConfirm";

/** Backend `limit` ≤ 100 (`normalizeQuery`). */
const PAGE_SIZES = [20, 50, 100] as const;
const SEARCH_DEBOUNCE_MS = 400;
const STATUS_VALUES: readonly MarketOperatorStatus[] = ["active", "inactive"];

/**
 * OPERATORLAR — market o'z operatorlarini boshqaradi (`/market-operators`, faqat market; ega qarori 2026-10-19).
 * Maketlar: `market-operators-list`, `-empty`, `-create-dialog`, `-commission-dialog`, `-commission-fixed-dialog`,
 * `-delete-dialog`.
 *
 * Sarlavha «Operatorlar» + «<market> nomidan …» va «Operator qo'shish»; «Komissiya belgilanmagan» ogohlantirishi
 * (joriy sahifa, faqat faol operatorlar); karta: qidiruv (ism yoki telefon, `search`) + «Holat» (`status`), jadval
 * (telefonda kartalar), pastda «N ta operator» yoki sahifalash (jami > sahifa hajmi bo'lsa). Bo'sh holat «Hali
 * operator yo'q» — sarlavhadagi tugma va filtrlarsiz, tugma bo'sh holat ichida (maket `-empty`).
 *
 * So'rov: `GET /market-operators?page&limit&search&status` (market_id yuborilmaydi — serverda JWT `sub`). Qator
 * menyusi: Komissiya oynasi va o'chirish (tasdiq bilan). «Nofaol qilish / Faollashtirish» — MO-4 (backend endpointi
 * kutilmoqda), shungacha holat faqat o'qiladi.
 */
const MarketOperatorsPage = () => {
  const { t, i18n } = useTranslation("marketOperators");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const marketName = useSelector((state: RootState) => state.user.user?.name?.trim() || null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(PAGE_SIZES[0]);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<MarketOperatorStatus | "">("");
  const [onlyUnset, setOnlyUnset] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [commissionOperator, setCommissionOperator] = useState<MarketOperator | null>(null);
  const confirmDelete = useDeleteOperatorConfirm();

  const searchTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(searchTimer.current), []);

  const commitSearch = (value: string) => {
    window.clearTimeout(searchTimer.current);
    const next = value.trim();
    if (next !== search) {
      setSearch(next);
      setPage(1);
    }
  };
  const handleSearchInput = (value: string) => {
    setSearchText(value);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => commitSearch(value), SEARCH_DEBOUNCE_MS);
  };

  const query = useMarketOperators({
    page,
    limit,
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
  });
  const { data, isLoading, isError, error, refetch, isFetching, isPlaceholderData } = query;
  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const filtersActive = Boolean(search || status);
  /** Umuman operator yo'q (filtrsiz) — maket `-empty`: sarlavhada tugma, ogohlantirish va filtrlar yo'q. */
  const noOperators = !filtersActive && data !== undefined && !isPlaceholderData && data.total === 0;

  // Oxirgi sahifadagi yagona operator o'chirilsa sahifa bo'shaydi — mavjud oxirgi sahifaga qaytiladi (render paytida).
  if (data && data.items.length === 0 && data.total > 0 && page > 1) {
    const lastPage = Math.max(1, Math.ceil(data.total / limit));
    if (lastPage < page) setPage(lastPage);
  }

  const unset = useMemo(() => operatorsWithoutCommission(items), [items]);
  // «Faqat ularni ko'rsatish» faqat 2+ operatorda ma'noli; komissiya belgilangach o'zi o'chadi.
  if (onlyUnset && unset.length < 2) setOnlyUnset(false);
  const rows = onlyUnset ? unset : items;

  const statusOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: t("list.statusAll") },
      ...STATUS_VALUES.map((value) => ({ value, label: t(`status.${value}`) })),
    ],
    [t],
  );

  const clearFilters = () => {
    window.clearTimeout(searchTimer.current);
    setSearchText("");
    setSearch("");
    setStatus("");
    setPage(1);
  };

  const openCreate = useCallback(() => setIsCreateOpen(true), []);
  const openCommission = useCallback((operator: MarketOperator) => setCommissionOperator(operator), []);
  const handleDelete = useCallback((operator: MarketOperator) => void confirmDelete(operator), [confirmDelete]);

  const changeLimit = (next: number) => {
    setLimit(next);
    setPage(1);
  };

  const total = data?.total ?? 0;
  const footer =
    data && total > 0 && !noOperators ? (
      total > limit ? (
        <Pagination
          page={data.page || page}
          pageSize={data.limit || limit}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={changeLimit}
          pageSizeOptions={PAGE_SIZES}
          disabled={isFetching}
          summary={(range) => t("list.pagination", range)}
        />
      ) : (
        <span className="text-[13px] text-text-muted">
          {t("list.summary", { total: formatNumberLocalized(total, { language }) })}
        </span>
      )
    ) : undefined;

  const addButton = (
    <Button leftIcon={UserPlus} aria-haspopup="dialog" onClick={openCreate}>
      {t("add")}
    </Button>
  );

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader
        title={t("title")}
        description={marketName ? t("description", { market: marketName }) : t("descriptionFallback")}
        actions={noOperators ? undefined : addButton}
      />

      {noOperators ? null : (
        <CommissionWarning
          operators={unset}
          onSet={openCommission}
          onlyUnset={onlyUnset}
          onToggleOnlyUnset={() => setOnlyUnset((value) => !value)}
        />
      )}

      <Card padding="none" aria-label={t("list.label")} footer={footer}>
        {noOperators ? null : (
          <div
            role="group"
            aria-label={t("list.filtersLabel")}
            className="flex flex-wrap items-center gap-3 px-5 py-4 max-md:px-4"
          >
            <TextInput
              mode="search"
              value={searchText}
              onValueChange={handleSearchInput}
              onClear={() => commitSearch("")}
              onSearch={commitSearch}
              placeholder={t("list.searchPlaceholder")}
              aria-label={t("list.searchLabel")}
              className="min-w-0 flex-[10_1_320px]"
            />
            <Field
              label={t("list.statusFilter")}
              hideLabel
              labelAs="span"
              className="min-w-0 flex-[1_1_200px] md:max-w-[420px] max-md:basis-full"
            >
              <Select
                options={statusOptions}
                value={status || null}
                onChange={(next) => {
                  setStatus((next ?? "") as MarketOperatorStatus | "");
                  setPage(1);
                }}
                placeholder={t("list.statusAll")}
                inlineLabel={t("list.statusFilter")}
                icon={CircleCheck}
              />
            </Field>
          </div>
        )}

        <QueryBoundary
          query={{ data: data ? rows : undefined, isLoading, isError, error, refetch }}
          loadingLabel={t("list.loading")}
          loading={<OperatorsSkeleton />}
          empty={
            filtersActive ? (
              <EmptyState
                icon={SearchX}
                title={t("list.notFoundTitle")}
                description={t("list.notFoundDescription")}
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    {t("list.clearFilters")}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Users}
                title={t("list.emptyTitle")}
                description={
                  marketName
                    ? t("list.emptyDescription", { market: marketName })
                    : t("list.emptyDescriptionFallback")
                }
                action={addButton}
              />
            )
          }
        >
          {(shownRows) => (
            <OperatorsTable
              rows={shownRows}
              busy={isFetching && isPlaceholderData}
              onCommission={openCommission}
              onDelete={handleDelete}
            />
          )}
        </QueryBoundary>
      </Card>

      <CreateOperatorDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        marketName={marketName}
        onSetCommission={openCommission}
      />
      <CommissionDialog operator={commissionOperator} onClose={() => setCommissionOperator(null)} />
    </div>
  );
};

export default memo(MarketOperatorsPage);
