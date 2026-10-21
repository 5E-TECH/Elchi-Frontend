// dizayn-v2: superadmin-notifications-sms-campaign-segment
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMarketLookup } from "../../markets/lookup";
import { useRegionDistrictCatalog } from "../../region";
import { useRegionLookup } from "../../region/lookup";
import { cx } from "../../../shared/lib/cx";
import { DateRange, Field, Select, TextInput, type SelectOption } from "../../../shared/ui/primitives";
import { parseMinOrders, type CustomerSegment } from "../model/segment";

export type CustomerSegmentFiltersProps = {
  value: CustomerSegment;
  onChange: (next: CustomerSegment) => void;
  /** Ro'yxatlar so'rovi (yashirin blokda yuklanmasin). Sukut `true`. */
  enabled?: boolean;
  /** «Oxirgi buyurtma» taqvimida bugungi kun (test va namuna). */
  today?: string;
  className?: string;
};

const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/**
 * «MIJOZ FILTRLARI» — maket `superadmin-notifications-sms-campaign-segment` (o'ng ustun, chiziq ostida).
 *
 * Viloyat va Tuman (`Select`, tuman ro'yxati viloyatdan keyin), Market (`Select` qidiruv bilan), «Oxirgi buyurtma»
 * (`DateRange`) va «Buyurtmalar soni» — faqat minimum («gacha» SMS kampaniyada yo'q — maketda «Taklif»). Har
 * ro'yxatda «Barchasi» — filtr yo'q. Viloyat almashsa tuman tozalanadi.
 *
 * Umumiy: SMS kampaniya (KM-1) va bildirishnoma «Auditoriya» rejimi (KM-2). Qiymat — `CustomerSegment`,
 * so'rov tanasi — `toCustomerSegmentPayload`.
 */
export const CustomerSegmentFilters = ({
  value,
  onChange,
  enabled = true,
  today,
  className,
}: CustomerSegmentFiltersProps) => {
  const { t } = useTranslation("sms");
  const regionId = value.region_id ?? "";
  const regions = useRegionLookup(enabled);
  const districts = useRegionDistrictCatalog(regionId, enabled);
  const markets = useMarketLookup(enabled);

  const all = t("segment.all");
  const regionOptions = useMemo<SelectOption[]>(
    () => [{ value: "", label: all }, ...(regions.data ?? []).map((item) => ({ value: item.id, label: item.name }))],
    [all, regions.data],
  );
  const districtOptions = useMemo<SelectOption[]>(
    () =>
      regionId
        ? [{ value: "", label: all }, ...(districts.data ?? []).map((item) => ({ value: item.id, label: item.name }))]
        : [],
    [all, districts.data, regionId],
  );
  const marketOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: all },
      ...(markets.data ?? []).map((item) => ({ value: item.id, label: item.name, searchText: item.phone })),
    ],
    [all, markets.data],
  );

  const set = (patch: Partial<CustomerSegment>) => onChange({ ...value, ...patch });
  const loadError = t("segment.loadError");

  return (
    <div className={cx("flex min-w-0 flex-col gap-4 border-t border-border pt-4", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="m-0 text-sm font-semibold text-text">{t("segment.title")}</h3>
        <span className="text-xs text-text-muted">{t("segment.scope")}</span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(140px,100%),1fr))] gap-4">
        <Field
          label={t("segment.region")}
          labelAs="span"
          className="min-w-0"
          hint={regions.isError ? loadError : undefined}
          hintLive
        >
          <Select
            options={regionOptions}
            value={regionId}
            onChange={(next) => set({ region_id: next || undefined, district_id: undefined })}
            loading={regions.isLoading}
          />
        </Field>
        <Field
          label={t("segment.district")}
          labelAs="span"
          className="min-w-0"
          disabled={!regionId}
          hint={districts.isError ? loadError : undefined}
          hintLive
        >
          <Select
            options={districtOptions}
            value={value.district_id ?? ""}
            onChange={(next) => set({ district_id: next || undefined })}
            placeholder={t("segment.districtNeedsRegion")}
            disabled={!regionId}
            loading={Boolean(regionId) && districts.isLoading}
          />
        </Field>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-4">
        <Field
          label={t("segment.market")}
          labelAs="span"
          className="min-w-0"
          hint={markets.isError ? loadError : undefined}
          hintLive
        >
          <Select
            searchable
            options={marketOptions}
            value={value.market_id ?? ""}
            onChange={(next) => set({ market_id: next || undefined })}
            loading={markets.isLoading}
          />
        </Field>
        <Field label={t("segment.lastOrder")} labelAs="span" className="min-w-0">
          <DateRange
            value={{ from: value.last_order_from ?? "", to: value.last_order_to ?? "" }}
            onChange={({ from, to }) => set({ last_order_from: from || undefined, last_order_to: to || undefined })}
            max={today ?? todayIso()}
            today={today}
            placeholder={t("segment.lastOrderAny")}
            className="w-full"
          />
        </Field>
        <Field label={t("segment.minOrders")} className="min-w-0">
          <TextInput
            mode="number"
            value={value.min_orders ? String(value.min_orders) : ""}
            placeholder={t("segment.minOrdersPlaceholder")}
            onValueChange={(next) => set({ min_orders: parseMinOrders(next) })}
          />
        </Field>
      </div>
    </div>
  );
};

export default CustomerSegmentFilters;
