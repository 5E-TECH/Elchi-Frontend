// dizayn-v2: superadmin-orders-filters-mobile, admin-orders-filters-mobile, registrator-orders-filters-mobile
import { useId, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ORDER_STATUS_NS, ORDER_STATUS_REGISTRY } from "../../../entities/order";
import { useOrders } from "../../../entities/order/api/orderApi";
import type { DeliveryType } from "../../../entities/order/types/order";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Button, DateRange, Dialog, Field, SegmentedControl, Select } from "../../../shared/ui/primitives";
import {
  buildOrderListParams,
  countPanelFilters,
  EMPTY_ORDER_FILTERS,
  FILTER_STATUSES,
  getOrderFilterScope,
  getQuickPeriodRange,
  hasDateRange,
  matchQuickPeriod,
  normalizeFilterStatuses,
  QUICK_PERIODS,
  readOrdersTotal,
  type OrderFilterValues,
  type QuickPeriod,
} from "./orderFilterModel";
import { useOrderFilterOptions, type FilterOption } from "./useOrderFilterOptions";

/**
 * «Filtrlar» pastki varaqasi — telefon (< 768), maketlar `superadmin-orders-filters-mobile` (admin ham shu) va
 * `registrator-orders-filters-mobile`. Varaqa QORALAMA bilan ishlaydi: «Natijalarni ko'rsatish (N)» URL'ga bir
 * marta yozadi va yopadi; ×, fon yoki tutqich — o'zgarishlar bekor; «Tozalash» — faqat qoralamani tozalaydi.
 * N — qoralama bo'yicha `GET /orders` soni (yuklanayotganda yoki xatoda son yozilmaydi).
 *
 * Bo'limlar (maketdagi tartib): Sana (tez davr segmenti + oraliq; sana asboblar qatorida ko'rinadigan rollarda —
 * menejer, market — yo'q) → Holat (chiplar, ko'p tanlov) → ikki ustunli ro'yxatlar (rolga qarab) → Yetkazish turi.
 */

/** Ichki «Barchasi» qiymati segmentlar uchun (URL'da — bo'sh). */
const ALL = "all";
/** Qo'lda tanlangan oraliq — segmentda hech biri tanlanmagan. */
const CUSTOM = "custom";

/** `.el-label` — `Field` yorlig'i bilan bir xil. */
const LABEL = "min-w-0 text-[13px] font-semibold text-text";

/** `.el-chip` (`aria-pressed`) — CODE-MAP 2.2; telefonda 44 px. */
const CHIP =
  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-border-strong bg-surface px-3 " +
  "text-[13px] font-medium text-text transition-[background-color,border-color,color,box-shadow] duration-150 " +
  "motion-reduce:transition-none hover:border-text-subtle aria-pressed:border-action aria-pressed:bg-action-soft " +
  "aria-pressed:font-semibold aria-pressed:text-action-fg max-md:h-11";

export type OrderFiltersSheetProps = {
  open: boolean;
  onClose: () => void;
  /** Hozirgi (URL) qiymatlar — varaqa har ochilganda qoralama shundan boshlanadi. */
  initial: OrderFilterValues;
  role: string | null;
  /** Sana bo'limi (superadmin, admin, registrator — telefonda sana maydoni asboblar qatorida yo'q). */
  withDate: boolean;
  /** Joriy qidiruv — son so'rovida hisobga olinadi. */
  search: string;
  onApply: (values: OrderFilterValues) => void;
};

const Section = ({ labelId, label, aside, children }: { labelId: string; label: string; aside?: ReactNode; children: ReactNode }) => (
  <div role="group" aria-labelledby={labelId} className="flex min-w-0 flex-col gap-2">
    {aside ? (
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <span id={labelId} className={LABEL}>
          {label}
        </span>
        {aside}
      </div>
    ) : (
      <span id={labelId} className={LABEL}>
        {label}
      </span>
    )}
    {children}
  </div>
);

export const OrderFiltersSheet = ({ open, onClose, initial, role, withDate, search, onApply }: OrderFiltersSheetProps) => {
  const { t } = useTranslation(["orders", "ui", ORDER_STATUS_NS]);
  const scope = getOrderFilterScope(role);
  const idBase = useId();
  const [draft, setDraft] = useState<OrderFilterValues>(initial);
  const [prevOpen, setPrevOpen] = useState(open);
  // Har ochilishda qoralama URL'dagi qiymatlardan boshlanadi (yopilganda kiritilgani bekor bo'lgan).
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setDraft(initial);
  }

  // Kuryerlar qoralamadagi viloyat bo'yicha (yopiq varaqada — URL'dagisi, ortiqcha so'rov ketmasin).
  const options = useOrderFilterOptions(role, open ? draft.regionId : initial.regionId);
  const { useGetOrders } = useOrders();
  const previewParams = useMemo(
    () => buildOrderListParams({ ...draft, search }, role, { page: 1, limit: 1 }),
    [draft, role, search],
  );
  // Son — yordamchi: xatoda u yashirinadi, umumiy «Ma'lumotni yuklab bo'lmadi» xabari varaqa ustiga chiqmaydi.
  const preview = useGetOrders(previewParams, open, undefined, { silentError: true });
  const previewTotal = preview.isPlaceholderData || preview.isError ? null : readOrdersTotal(preview.data);

  const selectedCount = countPanelFilters(draft, scope) + Number(withDate && hasDateRange(draft));
  const statusCount = draft.statuses.filter((status) => FILTER_STATUSES.includes(status)).length;
  const period = matchQuickPeriod(draft.dateFrom, draft.dateTo);

  const patch = (next: Partial<OrderFilterValues>) => setDraft((current) => ({ ...current, ...next }));
  const toggleStatus = (status: (typeof FILTER_STATUSES)[number]) =>
    setDraft((current) => {
      const next = current.statuses.includes(status)
        ? current.statuses.filter((item) => item !== status)
        : [...current.statuses, status];
      return { ...current, statuses: normalizeFilterStatuses(next) };
    });

  const reset = () =>
    // Sana bo'limi yo'q bo'lsa sana asboblar qatorida qoladi — «Tozalash» unga tegmaydi.
    setDraft({
      ...EMPTY_ORDER_FILTERS,
      dateFrom: withDate ? "" : draft.dateFrom,
      dateTo: withDate ? "" : draft.dateTo,
    });

  const apply = () => {
    onApply(draft);
    onClose();
  };

  const all = t("select.all", { ns: "ui" });
  const withAll = (items: FilterOption[]) => [{ value: "", label: all }, ...items];

  const selectField = (
    key: string,
    label: string,
    value: string,
    items: FilterOption[],
    loading: boolean,
    onChange: (value: string) => void,
  ) => (
    // Varaqada oddiy ro'yxat (maket: `aria-haspopup="listbox"` tugma): ikki ustunli tor maydonda qidiruv ikonkasi
    // va × qiymatni kesib qo'yardi, telefon klaviaturasi esa varaqani yopib qo'yardi.
    <Field key={key} label={label} labelAs="span">
      <Select
        options={withAll(items)}
        value={value}
        onChange={(next) => onChange(next ?? "")}
        placeholder={all}
        loading={loading}
      />
    </Field>
  );

  const fields: ReactNode[] = [];
  if (scope.marketSelect) {
    fields.push(
      selectField("market", t("filterMarket"), draft.marketId, options.markets, options.marketsLoading, (marketId) =>
        patch({ marketId }),
      ),
    );
  }
  if (scope.branch) {
    fields.push(
      selectField("branch", t("filterBranch"), draft.branchId, options.branches, options.branchesLoading, (branchId) =>
        patch({ branchId }),
      ),
    );
  }
  fields.push(
    scope.area === "district"
      ? selectField("district", t("district"), draft.districtId, options.districts, options.districtsLoading, (districtId) =>
          patch({ districtId, courierId: "" }),
        )
      : selectField("region", t("filterRegion"), draft.regionId, options.regions, options.regionsLoading, (regionId) =>
          patch({ regionId, courierId: "" }),
        ),
  );
  if (scope.courier) {
    fields.push(
      selectField("courier", t("filterCourier"), draft.courierId, options.couriers, options.couriersLoading, (courierId) =>
        patch({ courierId }),
      ),
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("filters.sheetTitle", { ns: "ui" })}
      description={t("filters.sheetSelected", { ns: "ui", count: selectedCount })}
      closeLabel={t("filters.sheetClose", { ns: "ui" })}
      // Maketda amallar ustida doim chiziq (`border-top: 1px solid var(--border)`).
      footerDivider
      footer={
        <>
          <Button variant="secondary" size="lg" className="max-md:flex-none!" onClick={reset}>
            {t("filters.reset", { ns: "ui" })}
          </Button>
          {/* Tor ekranda matn qisqaradi, son doim ko'rinadi (maket: `padding: 0 16px` — ixcham). */}
          <Button size="lg" compact className="min-w-0" onClick={apply}>
            <span className="flex min-w-0 items-center gap-1">
              <span className="min-w-0 truncate">{t("filters.apply", { ns: "ui" })}</span>
              {previewTotal === null ? null : (
                <span className="shrink-0">{t("filters.applyTotal", { ns: "ui", total: formatNumberLocalized(previewTotal) })}</span>
              )}
            </span>
          </Button>
        </>
      }
    >
      {withDate ? (
        <Section labelId={`${idBase}-date`} label={t("date.dateLabel", { ns: "ui" })}>
          <SegmentedControl<QuickPeriod | typeof CUSTOM>
            ariaLabel={t("filters.quickPeriod", { ns: "ui" })}
            fullWidth
            options={QUICK_PERIODS.map((key) => ({ value: key, label: t(`date.presets.${key}`, { ns: "ui" }) }))}
            value={period ?? CUSTOM}
            onValueChange={(key) => {
              if (key === CUSTOM) return;
              const range = getQuickPeriodRange(key);
              patch({ dateFrom: range.from, dateTo: range.to });
            }}
          />
          <DateRange
            value={{ from: draft.dateFrom, to: draft.dateTo }}
            onChange={({ from, to }) => patch({ dateFrom: from, dateTo: to })}
            presets={false}
            placeholder={t("date.rangeLabel", { ns: "ui" })}
            className="w-full"
          />
        </Section>
      ) : null}

      <Section
        labelId={`${idBase}-status`}
        label={t("filterStatus")}
        aside={
          statusCount > 0 ? (
            <span className="shrink-0 text-xs text-text-muted">{t("select.selectedCount", { ns: "ui", count: statusCount })}</span>
          ) : null
        }
      >
        <div className="flex flex-wrap gap-2">
          {FILTER_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={draft.statuses.includes(status)}
              onClick={() => toggleStatus(status)}
              className={CHIP}
            >
              {t(ORDER_STATUS_REGISTRY[status].labelKey, { ns: ORDER_STATUS_NS })}
            </button>
          ))}
        </div>
      </Section>

      <div className="grid grid-cols-2 gap-3">{fields}</div>

      <Section labelId={`${idBase}-delivery`} label={t("deliveryType")}>
        <SegmentedControl<typeof ALL | DeliveryType>
          ariaLabel={t("deliveryType")}
          fullWidth
          options={[
            { value: ALL, label: all },
            { value: "address", label: t("deliveryToHome") },
            { value: "center", label: t("deliveryToCenter") },
          ]}
          value={draft.deliveryType || ALL}
          onValueChange={(value) => patch({ deliveryType: value === ALL ? "" : value })}
        />
      </Section>
    </Dialog>
  );
};

export default OrderFiltersSheet;
