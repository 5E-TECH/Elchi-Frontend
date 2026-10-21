// dizayn-v2: superadmin-regions-sato-codes, superadmin-regions-sato-codes-not-found, superadmin-regions-sato-codes-edit, admin-regions-sato-codes, admin-regions-sato-codes-edit
import { useCallback, useMemo, useRef, useState } from "react";
import { CircleCheck, Info, Map as MapIcon, SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Pagination,
  QueryBoundary,
  Select,
  SkeletonTable,
  Tabs,
  TextInput,
  getPanelId,
  getTabId,
  type SelectOption,
  type TabItem,
} from "../../../../shared/ui/primitives";
import { useIsPhone } from "../../../../shared/ui/primitives/date/useIsPhone";
import {
  ADMIN_SATO_TABS,
  SUPERADMIN_SATO_TABS,
  filterSatoRows,
  paginateSatoRows,
  type SatoRow,
  type SatoTab,
  type SatoTabRows,
} from "../../model/satoModel";
import { useSatoCodeEditor } from "./useSatoCodeEditor";
import { SatoCodesTable } from "./SatoCodesTable";

/** Tab sonidagi belgi (`.el-tab-count`) — telefondagi bo'lim tanlagichida (maket: faol — ko'k). */
const COUNT_BADGE =
  "inline-flex h-5 min-w-[22px] items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums";
const COUNT_ACTIVE = "bg-action-soft text-action-fg";
const COUNT_IDLE = "bg-sunken text-text-muted";

const ID_PREFIX = "sato-status";

type Props = {
  variant: "superadmin" | "admin";
  /** `null` — hali yuklanmagan (yoki xato). */
  rows: SatoTabRows | null;
  /** «Takroriy nomlar» tab soni — guruhlar (yozuvlar emas). */
  duplicateGroups?: number;
  regionOptions: readonly { value: string; label: string }[];
  query: { isLoading: boolean; isError: boolean; error: unknown; isFetching: boolean; refetch: () => unknown };
  /** Kod saqlangach: preview va `/district` birga qayta yuklanadi. */
  onSaved: () => Promise<unknown>;
};

/**
 * «SATO kodlari» kartasi: holat tablari (telefonda `Select`), qidiruv + viloyat filtri, tab izohi, jadval /
 * kartalar, sahifalash (10 ta, klientda). Superadmin — Topildi · Topilmadi · Kodi bor · Takroriy nomlar ·
 * Bazada yo'q; admin — Kodsiz · Kodi bor (preview chaqirilmaydi). Bo'sh, yuklanish va xato holatlari maketdagi
 * «Boshqa holatlar» bo'yicha.
 */
export const SatoCodesPanel = ({ variant, rows, duplicateGroups = 0, regionOptions, query, onSaved }: Props) => {
  const { t, i18n } = useTranslation("region");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const number = (value: number) => formatNumberLocalized(value, { language });
  const isPhone = useIsPhone();
  const tabs: readonly SatoTab[] = variant === "superadmin" ? SUPERADMIN_SATO_TABS : ADMIN_SATO_TABS;

  const [tab, setTab] = useState<SatoTab>(tabs[0]);
  const [search, setSearch] = useState("");
  const [regionId, setRegionId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const searchRef = useRef<HTMLInputElement>(null);

  const editor = useSatoCodeEditor({ onSaved, fallbackFocus: useCallback(() => searchRef.current, []) });

  const tabLabel = (value: SatoTab) => t(`v2.sato.tabs.${value}`);
  const countOf = (value: SatoTab): number | undefined => {
    if (!rows) return undefined;
    if (value === "duplicates") return duplicateGroups;
    return rows[value]?.length ?? 0;
  };

  const tabRows = useMemo<SatoRow[]>(() => rows?.[tab] ?? [], [rows, tab]);
  const filtered = useMemo(() => filterSatoRows(tabRows, { search, regionId }), [tabRows, search, regionId]);
  const paged = paginateSatoRows(filtered, page, pageSize);
  const hasFilters = search.trim().length > 0 || regionId != null;

  const resetView = () => {
    setPage(1);
    if (editor.editingId) editor.cancel();
  };
  const selectTab = (value: SatoTab) => {
    if (value === tab) return;
    setTab(value);
    resetView();
  };
  const clearFilters = () => {
    setSearch("");
    setRegionId(null);
    resetView();
  };

  const countBadge = (value: SatoTab, selected: boolean) => {
    const count = countOf(value);
    if (count === undefined) return null;
    return <span className={cx(COUNT_BADGE, selected ? COUNT_ACTIVE : COUNT_IDLE)}>{number(count)}</span>;
  };
  const tabItems: TabItem<SatoTab>[] = tabs.map((value) => ({ value, label: tabLabel(value), count: countOf(value) }));
  const tabOptions: SelectOption<SatoTab>[] = tabs.map((value) => ({ value, label: tabLabel(value) }));
  const regionSelectOptions: SelectOption[] = [
    { value: "", label: t("v2.sato.filters.allRegions") },
    ...regionOptions.map((option) => ({ value: option.value, label: option.label })),
  ];

  const unit = tab === "missing" ? "records" : "districts";
  const total = filtered.length;
  const summary =
    tab === "duplicates" && !hasFilters
      ? t("v2.sato.footer.duplicates", {
          names: number(duplicateGroups),
          count: total,
          value: number(total),
        })
      : t(`v2.sato.footer.${unit}`, { count: total, value: number(total) });
  const footer =
    rows && total > 0 ? (
      total > pageSize ? (
        <Pagination
          page={paged.page}
          pageSize={pageSize}
          total={total}
          onPageChange={(next) => {
            setPage(next);
            if (editor.editingId) editor.cancel();
          }}
          onPageSizeChange={(next) => {
            setPageSize(next);
            resetView();
          }}
          summary={(range) => t(`v2.sato.footer.${unit}Range`, { ...range, count: total })}
        />
      ) : (
        <span className="text-[13px] text-text-muted tabular-nums">{summary}</span>
      )
    ) : undefined;

  const loadErrorTitle = t(variant === "superadmin" ? "v2.sato.states.previewError" : "v2.sato.states.districtsError");

  const emptyTab = (
    <EmptyState
      icon={tab === "noCode" || tab === "found" ? CircleCheck : MapIcon}
      title={t(`v2.sato.empty.${tab}.title`)}
      description={t(`v2.sato.empty.${tab}.description`)}
    />
  );
  const emptyFiltered = (
    <EmptyState
      icon={SearchX}
      title={t("v2.sato.empty.filtered.title")}
      description={t("v2.sato.empty.filtered.description")}
      action={
        <Button variant="secondary" onClick={clearFilters}>
          {t("v2.sato.filters.clear")}
        </Button>
      }
    />
  );

  return (
    <Card as="section" padding="none" aria-label={t(`v2.sato.sectionAria.${tab}`)} footer={footer}>
      {isPhone ? (
        <div className="border-b border-border px-4 py-3">
          <Select<SatoTab>
            aria-label={t("v2.sato.statusSelectAria", { tab: tabLabel(tab) })}
            options={tabOptions}
            value={tab}
            onChange={(value) => {
              if (value) selectTab(value);
            }}
            valueAddon={countBadge(tab, true)}
            renderOption={(option, state) => (
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="min-w-0 truncate">{option.label}</span>
                {countBadge(option.value, state.selected)}
              </span>
            )}
            className="font-semibold"
          />
        </div>
      ) : (
        <Tabs<SatoTab>
          items={tabItems}
          value={tab}
          onValueChange={selectTab}
          ariaLabel={t("v2.sato.statusTabsAria")}
          idPrefix={ID_PREFIX}
          controlsPanel
          listClassName="px-3"
        />
      )}

      <div
        role={isPhone ? undefined : "tabpanel"}
        id={isPhone ? undefined : getPanelId(ID_PREFIX, tab)}
        aria-labelledby={isPhone ? undefined : getTabId(ID_PREFIX, tab)}
        className="flex min-w-0 flex-col"
      >
        <div className="flex flex-col gap-3 px-5 py-4 max-md:px-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t("v2.sato.filters.searchAria")} hideLabel className="min-w-0 flex-[1_1_260px] md:max-w-[520px]">
              <TextInput
                ref={searchRef}
                mode="search"
                value={search}
                onValueChange={(value) => {
                  setSearch(value);
                  resetView();
                }}
                placeholder={t("v2.sato.filters.searchPlaceholder")}
                autoComplete="off"
              />
            </Field>
            <Field
              label={t("v2.sato.filters.region")}
              hideLabel
              labelAs="span"
              className="min-w-0 flex-[0_1_220px] max-md:flex-[1_1_100%]"
            >
              <Select
                options={regionSelectOptions}
                value={regionId ?? ""}
                onChange={(value) => {
                  setRegionId(value || null);
                  resetView();
                }}
                inlineLabel={t("v2.sato.filters.region")}
                searchable={regionSelectOptions.length > 8}
              />
            </Field>
          </div>
          <p className="m-0 flex items-start gap-2 text-[13px] leading-[18px] text-text-muted">
            <Info size={16} aria-hidden="true" className="mt-px shrink-0" />
            <span className="min-w-0">{t(`v2.sato.info.${tab}`)}</span>
          </p>
        </div>

        <QueryBoundary
          query={{
            data: rows ? paged.items : undefined,
            isLoading: query.isLoading,
            isError: query.isError,
            error: query.error,
            isFetching: query.isFetching,
            refetch: query.refetch,
          }}
          keepPreviousData={false}
          loadingLabel={t(variant === "superadmin" ? "v2.sato.states.previewLoading" : "v2.sato.states.districtsLoading")}
          loading={<SkeletonTable framed={false} rows={6} />}
          empty={hasFilters && tabRows.length > 0 ? emptyFiltered : emptyTab}
          error={(error, retry) => (
            <ErrorState
              error={error}
              title={loadErrorTitle}
              description={t("v2.sato.states.loadErrorText")}
              onRetry={retry}
              retrying={query.isFetching}
            />
          )}
          className="border-t border-border"
        >
          {(items, { isRefetching }) => (
            <SatoCodesTable
              tab={tab}
              rows={items}
              editor={editor}
              busy={isRefetching}
              label={t(`v2.sato.sectionAria.${tab}`)}
            />
          )}
        </QueryBoundary>
      </div>
    </Card>
  );
};
