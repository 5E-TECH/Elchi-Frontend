// dizayn-v2: (maket yo'q) superadmin-orders-filters-mobile
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Button, DateRange, Dialog, Field, Select, type SelectOption } from "../../../shared/ui/primitives";
import { EMPTY_OLD_MAILS_FILTERS, type OldMailsFilters } from "../model/oldMailsModel";

/**
 * «Eski pochtalar» — telefon (< 768) filtr varaqasi. Maket yo'q — eng yaqini `superadmin-orders-filters-mobile`
 * (`pages/orders/list/OrderFiltersSheet.tsx` namunasi). Varaqa QORALAMA bilan ishlaydi: «Natijalarni ko'rsatish (N)»
 * URL'ga bir marta yozadi va yopadi; ×, fon yoki tutqich — o'zgarishlar bekor; «Tozalash» — faqat qoralamani
 * tozalaydi. N — qoralama bo'yicha mijoz tomonidagi filtr natijasi (ro'yxat to'liq yuklangan).
 *
 * Bo'limlar: Sana (`withDate` — xodimda; kuryerda sana asboblar qatorida) → Viloyat · Kuryer (xodim, pochtalar
 * rejimi) · Holati.
 */

export type OldMailsFiltersSheetProps = {
  open: boolean;
  onClose: () => void;
  /** Hozirgi (URL) qiymatlar — har ochilishda qoralama shundan boshlanadi. */
  initial: OldMailsFilters;
  withDate: boolean;
  withCourier: boolean;
  regionOptions: readonly SelectOption[];
  courierOptions: readonly SelectOption[];
  statusOptions: readonly SelectOption[];
  regionsLoading?: boolean;
  couriersLoading?: boolean;
  /** Qoralama bo'yicha natija soni. */
  previewCount: (draft: OldMailsFilters) => number;
  onApply: (values: OldMailsFilters) => void;
};

export const OldMailsFiltersSheet = ({
  open,
  onClose,
  initial,
  withDate,
  withCourier,
  regionOptions,
  courierOptions,
  statusOptions,
  regionsLoading = false,
  couriersLoading = false,
  previewCount,
  onApply,
}: OldMailsFiltersSheetProps) => {
  const { t, i18n } = useTranslation(["mailsArchive", "ui"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [draft, setDraft] = useState<OldMailsFilters>(initial);
  const [prevOpen, setPrevOpen] = useState(open);
  // Har ochilishda qoralama URL'dagi qiymatlardan boshlanadi (yopilganda kiritilgani bekor bo'lgan).
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setDraft(initial);
  }

  const patch = (next: Partial<OldMailsFilters>) => setDraft((current) => ({ ...current, ...next }));
  const selectedCount = [
    draft.regionId,
    withCourier ? draft.courierId : "",
    draft.status,
    withDate ? draft.dateFrom || draft.dateTo : "",
  ].filter(Boolean).length;
  const total = previewCount(draft);

  const reset = () =>
    // Sana bo'limi yo'q bo'lsa sana asboblar qatorida qoladi — «Tozalash» unga tegmaydi.
    setDraft({
      ...EMPTY_OLD_MAILS_FILTERS,
      dateFrom: withDate ? "" : draft.dateFrom,
      dateTo: withDate ? "" : draft.dateTo,
    });

  const apply = () => {
    onApply(draft);
    onClose();
  };

  const all = t("ui:select.all");
  const withAll = (items: readonly SelectOption[]) => [{ value: "", label: all }, ...items];

  const selectField = (
    key: string,
    label: string,
    value: string,
    items: readonly SelectOption[],
    loading: boolean,
    onChange: (value: string) => void,
  ) => (
    // Varaqada oddiy ro'yxat (qidiruvsiz): telefon klaviaturasi varaqani yopib qo'ymasin.
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("ui:filters.sheetTitle")}
      description={t("ui:filters.sheetSelected", { count: selectedCount })}
      closeLabel={t("ui:filters.sheetClose")}
      footerDivider
      footer={
        <>
          <Button variant="secondary" size="lg" className="max-md:flex-none!" onClick={reset}>
            {t("ui:filters.reset")}
          </Button>
          <Button size="lg" compact className="min-w-0" onClick={apply}>
            <span className="flex min-w-0 items-center gap-1">
              <span className="min-w-0 truncate">{t("ui:filters.apply")}</span>
              <span className="shrink-0">
                {t("ui:filters.applyTotal", { total: formatNumberLocalized(total, { language }) })}
              </span>
            </span>
          </Button>
        </>
      }
    >
      {withDate ? (
        <Field label={t("old.filters.date")} labelAs="span">
          <DateRange
            value={{ from: draft.dateFrom, to: draft.dateTo }}
            onChange={({ from, to }) => patch({ dateFrom: from, dateTo: to })}
            placeholder={t("old.filters.dateRange")}
            className="w-full"
          />
        </Field>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        {selectField("region", t("old.filters.region"), draft.regionId, regionOptions, regionsLoading, (regionId) =>
          patch({ regionId }),
        )}
        {withCourier
          ? selectField("courier", t("old.filters.courier"), draft.courierId, courierOptions, couriersLoading, (courierId) =>
              patch({ courierId }),
            )
          : null}
        {selectField("status", t("old.filters.status"), draft.status, statusOptions, false, (status) => patch({ status }))}
      </div>
    </Dialog>
  );
};

export default OldMailsFiltersSheet;
