// dizayn-v2: superadmin-activity-logs-list, admin-activity-logs-list
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ListFilter } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ACTIVITY_SERVICES, type ActivityActionsCatalog } from "../../../entities/activity-log";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Button, DateRange, Dialog, Field, Select, TextInput, type SelectOption } from "../../../shared/ui/primitives";
import {
  buildActionOptions,
  countSheetFilters,
  hasActivityFilters,
  type ActivityLogFilterValues,
  type SheetValues,
} from "../model/activityFilters";
import type { ActivityLabels } from "../model/useActivityLabels";

/**
 * Faoliyat jurnali filtrlari — dizayn v2 (maket `superadmin-activity-logs-list`, admin ham shu).
 * Desktop/planshet: setka (qidiruv · «Xizmat:» · «Amal:» · Obyekt turi · Foydalanuvchi ID · sana +
 * «Filtrlarni tozalash»), o'zgarish darhol qo'llanadi. Telefon: qidiruv, sana va «Filtrlar» — qolgan
 * to'rttasi pastki varaqada (qoralama; «Natijalarni ko'rsatish» bir marta qo'llaydi; eng yaqin namuna
 * `superadmin-orders-filters-mobile`).
 *
 * «Amal» (y8CxCtcK): `GET /activity-logs/actions` → `categories` tartibida guruhlar, ichida
 * `registry[].label`, qiymati — fe'l. Reyestrsiz (eski backend) — fe'llar humanize, guruhsiz.
 */

const SEARCH_DEBOUNCE_MS = 400;

/** «Filtrlar 2» soni (`.el-tab-count` + `action-soft`). */
const COUNT_PILL =
  "inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-action-soft px-1.5 text-xs font-semibold text-action-fg";

type Props = {
  values: ActivityLogFilterValues;
  onChange: (patch: Partial<ActivityLogFilterValues>) => void;
  onClear: () => void;
  catalog: ActivityActionsCatalog | undefined;
  catalogLoading: boolean;
  labels: ActivityLabels;
};

const ActivityLogFilters = ({ values, onChange, onClear, catalog, catalogLoading, labels }: Props) => {
  const { t } = useTranslation(["activityLogs", "ui"]);
  const allLabel = t("filters.all");

  const serviceOptions = useMemo<SelectOption[]>(
    () => [{ value: "", label: allLabel }, ...ACTIVITY_SERVICES.map((name) => ({ value: name, label: labels.service(name) }))],
    [allLabel, labels],
  );
  const actionOptions = useMemo(() => buildActionOptions(catalog, allLabel), [allLabel, catalog]);

  // ─── Qidiruv: yozish kechikish bilan, Enter / × — darhol ───────────────
  const [searchText, setSearchText] = useState(values.search);
  const [prevSearch, setPrevSearch] = useState(values.search);
  if (prevSearch !== values.search) {
    // Tashqaridan o'zgardi («Filtrlarni tozalash») — maydon ham.
    setPrevSearch(values.search);
    setSearchText(values.search);
  }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const commitSearch = (text: string, delay = 0) => {
    if (timer.current) clearTimeout(timer.current);
    if (delay === 0) {
      onChange({ search: text.trim() });
      return;
    }
    timer.current = setTimeout(() => onChange({ search: text.trim() }), delay);
  };

  // ─── Telefon varaqasi (qoralama) ───────────────────────────────────────
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<SheetValues>(values);
  const sheetCount = countSheetFilters(values);
  const openSheet = () => {
    setDraft({ service: values.service, action: values.action, entityType: values.entityType, userId: values.userId });
    setSheetOpen(true);
  };
  const applySheet = () => {
    onChange(draft);
    setSheetOpen(false);
  };

  const serviceSelect = (value: string, onValue: (next: string) => void, inline: boolean) => (
    <Select
      options={serviceOptions}
      value={value}
      onChange={(next) => onValue(next ?? "")}
      inlineLabel={inline ? t("filters.service") : undefined}
      aria-label={inline ? t("filters.service") : undefined}
      listLabel={t("filters.service")}
    />
  );
  const actionSelect = (value: string, onValue: (next: string) => void, inline: boolean) => (
    <Select
      options={actionOptions}
      value={value}
      onChange={(next) => onValue(next ?? "")}
      inlineLabel={inline ? t("filters.action") : undefined}
      aria-label={inline ? t("filters.action") : undefined}
      listLabel={t("filters.action")}
      loading={catalogLoading}
    />
  );

  return (
    <>
      <div
        role="search"
        aria-label={t("filters.label")}
        className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-3 px-5 py-4 max-md:px-4"
      >
        <TextInput
          mode="search"
          value={searchText}
          placeholder={t("filters.search")}
          aria-label={t("filters.search")}
          onValueChange={(text) => {
            setSearchText(text);
            commitSearch(text, SEARCH_DEBOUNCE_MS);
          }}
          onSearch={(text) => commitSearch(text)}
          onClear={() => commitSearch("")}
        />
        <div className="min-w-0 max-md:hidden">{serviceSelect(values.service, (service) => onChange({ service }), true)}</div>
        <div className="min-w-0 max-md:hidden">{actionSelect(values.action, (action) => onChange({ action }), true)}</div>
        <TextInput
          className="max-md:hidden"
          value={values.entityType}
          placeholder={t("filters.entityType")}
          aria-label={t("filters.entityTypeLabel")}
          clearable
          onValueChange={(entityType) => onChange({ entityType })}
        />
        <TextInput
          className="max-md:hidden"
          mode="number"
          value={values.userId}
          placeholder={t("filters.userId")}
          aria-label={t("filters.userId")}
          clearable
          onValueChange={(userId) => onChange({ userId })}
        />
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <DateRange
            className="min-w-0 flex-[1_1_auto]"
            value={{ from: values.dateFrom, to: values.dateTo }}
            onChange={({ from, to }) => onChange({ dateFrom: from, dateTo: to })}
            aria-label={t("filters.dateRange")}
          />
          {hasActivityFilters(values) ? (
            <Button variant="link" size="sm" className="flex-none max-md:hidden" onClick={onClear}>
              {t("filters.clear")}
            </Button>
          ) : null}
          <Button
            variant="secondary"
            leftIcon={ListFilter}
            className="flex-[1_0_auto] md:hidden"
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            onClick={openSheet}
          >
            {t("filters.button", { ns: "ui" })}
            {sheetCount > 0 ? <span className={COUNT_PILL}>{formatNumberLocalized(sheetCount)}</span> : null}
          </Button>
        </div>
      </div>

      <Dialog
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t("filters.sheetTitle", { ns: "ui" })}
        description={t("filters.sheetSelected", { ns: "ui", count: countSheetFilters(draft) })}
        closeLabel={t("filters.sheetClose", { ns: "ui" })}
        footerDivider
        footer={
          <>
            <Button
              variant="secondary"
              size="lg"
              className="max-md:flex-none!"
              onClick={() => setDraft({ service: "", action: "", entityType: "", userId: "" })}
            >
              {t("filters.reset", { ns: "ui" })}
            </Button>
            <Button size="lg" onClick={applySheet}>
              {t("filters.apply", { ns: "ui" })}
            </Button>
          </>
        }
      >
        <Field label={t("filters.service")} labelAs="span">
          {serviceSelect(draft.service, (service) => setDraft((current) => ({ ...current, service })), false)}
        </Field>
        <Field label={t("filters.action")} labelAs="span">
          {actionSelect(draft.action, (action) => setDraft((current) => ({ ...current, action })), false)}
        </Field>
        <Field label={t("filters.entityTypeLabel")}>
          <TextInput
            value={draft.entityType}
            placeholder={t("filters.entityType")}
            clearable
            onValueChange={(entityType) => setDraft((current) => ({ ...current, entityType }))}
          />
        </Field>
        <Field label={t("filters.userId")}>
          <TextInput
            mode="number"
            value={draft.userId}
            clearable
            onValueChange={(userId) => setDraft((current) => ({ ...current, userId }))}
          />
        </Field>
      </Dialog>
    </>
  );
};

export default memo(ActivityLogFilters);
