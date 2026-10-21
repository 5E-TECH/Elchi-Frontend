// dizayn-v2: superadmin-notifications-sms-campaign-segment
import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMarketLookup } from "../../markets/lookup";
import { useRegionDistrictCatalog } from "../../region";
import { useRegionLookup } from "../../region/lookup";
import { cx } from "../../../shared/lib/cx";
import { useDebounce } from "../../../shared/lib/useDebounce";
import { DateRange, Field, Select, TextInput, type SelectOption } from "../../../shared/ui/primitives";
import { parseMinOrders, type CustomerSegment } from "../model/segment";

export type CustomerSegmentFiltersProps = {
  value: CustomerSegment;
  onChange: (next: CustomerSegment) => void;
  /** Ro'yxatlar so'rovi (yashirin blokda yuklanmasin). Sukut `true`. */
  enabled?: boolean;
  /** «Oxirgi buyurtma» taqvimida bugungi kun (test va namuna). */
  today?: string;
  /**
   * «Buyurtmalar soni» — «dan – gacha» (bildirishnoma auditoriyasi, KM-2: `segment.max_orders` bor). Sukut `false` —
   * faqat minimum (SMS kampaniyasi DTO'sida «gacha» yo'q).
   */
  withMaxOrders?: boolean;
  /** Teskari oraliq («dan» > «gacha») xatosi — «gacha» maydoni ostida. */
  orderRangeError?: string;
  /** Tanlangan market nomi (segmentni saqlash oynasidagi xulosa uchun). */
  onMarketLabel?: (label: string | null) => void;
  /** Hamma maydon o'chiq (forma qulflangan — xabar yuborilgan). */
  disabled?: boolean;
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
  withMaxOrders = false,
  orderRangeError,
  onMarketLabel,
  disabled = false,
  className,
}: CustomerSegmentFiltersProps) => {
  const { t } = useTranslation("sms");
  const ordersLabelId = useId();
  const regionId = value.region_id ?? "";
  const regions = useRegionLookup(enabled);
  const districts = useRegionDistrictCatalog(regionId, enabled, { silentError: true });
  // Market — server qidiruvi: backend bir so'rovda ko'pi bilan 100 ta beradi, ro'yxat to'liq emas bo'lishi mumkin.
  const [marketSearch, setMarketSearch] = useState("");
  const updateMarketSearch = useDebounce((next: string) => setMarketSearch(next.trim()), 350);
  const markets = useMarketLookup(marketSearch, enabled);
  /** Tanlangan market nomi — qidiruv natijasi almashsa ham maydonda qolsin. */
  const [pickedMarket, setPickedMarket] = useState<SelectOption | null>(null);

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
  const marketId = value.market_id ?? "";
  const marketOptions = useMemo<SelectOption[]>(() => {
    const found = (markets.data?.items ?? []).map((item) => ({ value: item.id, label: item.name }));
    const picked =
      pickedMarket && pickedMarket.value === marketId && !found.some((item) => item.value === marketId)
        ? [pickedMarket]
        : [];
    return [{ value: "", label: all }, ...picked, ...found];
  }, [all, markets.data, marketId, pickedMarket]);
  const marketsCut =
    !marketSearch && markets.data && markets.data.total > markets.data.items.length ? markets.data : null;

  const set = (patch: Partial<CustomerSegment>) => onChange({ ...value, ...patch });
  const loadError = t("segment.loadError");

  return (
    <div className={cx("flex min-w-0 flex-col gap-4 border-t border-border pt-4", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="m-0 text-sm font-semibold text-text">{t("segment.title")}</h3>
        <span className="text-xs text-text-muted">{t("segment.scope")}</span>
      </div>

      {/* 160px: telefonda (390) Viloyat va Tuman ustma-ust — tanlangan nom × tugmasi bilan kesilmaydi. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(160px,100%),1fr))] gap-4">
        <Field
          label={t("segment.region")}
          labelAs="span"
          className="min-w-0"
          disabled={disabled}
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
          disabled={disabled || !regionId}
          hint={districts.isError ? loadError : undefined}
          hintLive
        >
          <Select
            options={districtOptions}
            value={value.district_id ?? ""}
            onChange={(next) => set({ district_id: next || undefined })}
            placeholder={t("segment.districtNeedsRegion")}
            disabled={disabled || !regionId}
            loading={Boolean(regionId) && districts.isLoading}
          />
        </Field>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-4">
        <Field
          label={t("segment.market")}
          labelAs="span"
          className="min-w-0"
          disabled={disabled}
          hint={
            markets.isError
              ? loadError
              : marketsCut
                ? t("segment.marketMore", { shown: marketsCut.items.length, total: marketsCut.total })
                : undefined
          }
          hintLive
        >
          <Select
            searchable
            filter={false}
            onSearchChange={updateMarketSearch}
            options={marketOptions}
            value={marketId}
            onChange={(next, option) => {
              setPickedMarket(next && option ? { value: option.value, label: option.label } : null);
              onMarketLabel?.(next && option ? option.label : null);
              set({ market_id: next || undefined });
            }}
            loading={markets.isFetching}
          />
        </Field>
        <Field label={t("segment.lastOrder")} labelAs="span" className="min-w-0" disabled={disabled}>
          <DateRange
            value={{ from: value.last_order_from ?? "", to: value.last_order_to ?? "" }}
            onChange={({ from, to }) => set({ last_order_from: from || undefined, last_order_to: to || undefined })}
            max={today ?? todayIso()}
            today={today}
            placeholder={t("segment.lastOrderAny")}
            className="w-full"
          />
        </Field>
        {withMaxOrders ? (
          <div role="group" aria-labelledby={ordersLabelId} className="flex min-w-0 flex-col gap-1.5">
            <span id={ordersLabelId} className="min-w-0 text-[13px] font-semibold text-text">
              {t("segment.minOrders")}
            </span>
            <div className="flex min-w-0 items-start gap-2">
              <Field label={t("segment.ordersFrom")} hideLabel className="min-w-0 flex-1" disabled={disabled}>
                <TextInput
                  mode="number"
                  value={value.min_orders ? String(value.min_orders) : ""}
                  placeholder={t("segment.minOrdersPlaceholder")}
                  onValueChange={(next) => set({ min_orders: parseMinOrders(next) })}
                />
              </Field>
              <span aria-hidden="true" className="flex h-10 items-center text-text-muted max-md:h-11">
                –
              </span>
              <Field
                label={t("segment.ordersTo")}
                hideLabel
                className="min-w-0 flex-1"
                disabled={disabled}
                error={orderRangeError}
              >
                <TextInput
                  mode="number"
                  value={value.max_orders ? String(value.max_orders) : ""}
                  placeholder={t("segment.maxOrdersPlaceholder")}
                  onValueChange={(next) => set({ max_orders: parseMinOrders(next) })}
                />
              </Field>
            </div>
          </div>
        ) : (
          <Field label={t("segment.minOrders")} className="min-w-0" disabled={disabled}>
            <TextInput
              mode="number"
              value={value.min_orders ? String(value.min_orders) : ""}
              placeholder={t("segment.minOrdersPlaceholder")}
              onValueChange={(next) => set({ min_orders: parseMinOrders(next) })}
            />
          </Field>
        )}
      </div>
    </div>
  );
};

export default CustomerSegmentFilters;
