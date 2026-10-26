// dizayn-v2: superadmin-orders-list, superadmin-orders-filters-mobile, admin-orders-list, admin-orders-filters-mobile, registrator-orders-list, registrator-orders-filters-mobile, market-orders-list, manager-orders-list-all, manager-orders-list-pending, manager-orders-list-cancelled
import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { ListFilter, X } from "lucide-react";
import type { RootState } from "../../../app/config/store";
import { ORDER_STATUS_NS, ORDER_STATUS_REGISTRY } from "../../../entities/order";
import type { OrderStatus } from "../../../entities/order/types/order";
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { extractScannerToken } from "../../../shared/lib/scanToken";
import { useQueryParams } from "../../../shared/lib/useQueryParams";
import { resetFilters, setFilterValue } from "../../../shared/model/filterSlice";
import { clearAllSearch, setSearchValue } from "../../../shared/model/searchSlice";
import {
  Button,
  DateRange,
  Field,
  Pressable,
  Select,
  TextInput,
} from "../../../shared/ui/primitives";
import { formatDay, formatRangeShort } from "../../../shared/ui/primitives/date/calendarMath";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import {
  countPanelFilters,
  FILTER_STATUSES,
  getOrderFilterScope,
  hasDateRange,
  isDeliveryType,
  isFulfillmentSource,
  LEGACY_DATE_FROM_KEY,
  LEGACY_DATE_TO_KEY,
  LEGACY_ORDER_STATUS_URL_KEY,
  ORDER_CANCEL_STAGE_URL_KEY,
  matchOrderStatusTab,
  normalizeFilterStatuses,
  normalizeOrderSearch,
  ORDER_FILTER_KEYS,
  ORDER_STATUS_URL_KEY,
  parseStatusValues,
  sanitizeDayParam,
  type OrderFilterValues,
} from "./orderFilterModel";
import { OrderFiltersSheet } from "./OrderFiltersSheet";
import { useOrderFilterOptions, type FilterOption } from "./useOrderFilterOptions";
import { isMarketSideRole } from "../../../entities/user/lib/role";

/**
 * «Buyurtmalar» ro'yxati filtrlari — dizayn v2 (maketlar `superadmin-orders-list`, `admin-orders-list`,
 * `registrator-orders-list`, `market-orders-list`, `manager-orders-list-*`; telefon varaqasi —
 * `*-orders-filters-mobile`, `OrderFiltersSheet.tsx`).
 *
 * Ro'yxat kartasi ichida (`Card padding="none"`, tablardan keyin) chiziladi va o'zi uchta qator beradi:
 *   1. asboblar qatori — qidiruv · sana oralig'i · «Filtrlar N» (desktop/planshetda panelni ochadi-yopadi,
 *      telefonda pastki varaqani ochadi);
 *   2. «Qo'shimcha filtrlar» paneli (desktop/planshet) — market, filial, viloyat/tuman, kuryer, yetkazish turi,
 *      manba (6kHnNH9j: Ombordan · HQ orqali; xodimlarda), holat (rolga qarab); o'zgarish darhol qo'llanadi;
 *   3. faol filtr chiplari + «Filtrlarni tozalash».
 *
 * URL — yagona manba (Redux ko'zgusi avvalgidek yoziladi): kalitlar `ORDER_FILTER_KEYS`, holat — `status`.
 * Telefonda sana superadmin/admin/registratorda varaqada (asboblar qatorida yo'q), menejer va marketda — qatorda.
 * Holat tab bilan ko'rsatilgan bo'lsa (`statusTabs`, tab to'plamiga aynan mos) — u filtr soniga, chipga va
 * «Filtrlarni tozalash» ga kirmaydi; «Holat» ro'yxatidan boshqa to'plam tanlansa — filtr.
 */

type Props = {
  /**
   * Sahifada holat tablari bor (sukut `true`): tab to'plamiga mos holat filtr hisoblanmaydi (maket
   * `manager-orders-list-pending` — «Kutilmoqda» tabida «Filtrlar» sonsiz, chip yo'q).
   */
  statusTabs?: boolean;
};

/** Qidiruv kechikishi (avvalgi `FilterSearch` dagidek); tozalash va Enter — darhol. */
const SEARCH_DEBOUNCE_MS = 600;

/** `.el-tab-count` + `action-soft` (maket: «Filtrlar 2»). */
const COUNT_PILL =
  "inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-action-soft px-1.5 text-xs font-semibold text-action-fg";

/** `.el-chip.el-chip-active` (CODE-MAP 2.2); telefonda 44 px. */
const CHIP =
  "inline-flex h-8 max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-action " +
  "bg-action-soft pl-3 pr-1 text-[13px] font-semibold text-action-fg max-md:h-11 max-md:pr-0";

/**
 * `.el-chip-x`: desktopda 28 px (maket `width: 28px; margin-right: -8px` — chip o'ng chekkasidan 4 px), telefonda
 * chip balandligicha 44 px, o'ng chekkagacha (`registrator-orders-list`, `manager-orders-list-all` telefon:
 * `44px; margin: 0 -14px 0 -10px`).
 */
const CHIP_X =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-action-fg " +
  "transition-[background-color] duration-150 motion-reduce:transition-none hover:bg-action/15 " +
  "max-md:-ml-2.5 max-md:size-11";

/** QR havolasi (`https://…/scan/<token>`) → token; boshqa matn o'zgarmaydi (avvalgi `FilterSearch` dagidek). */
const normalizePossibleScanValue = (value: string) => {
  if (!value.includes("/scan/")) return value;
  const token = extractScannerToken(value, window.location.origin);
  return token && token.length >= 6 ? token : value;
};

/** Bitta kechiktirilgan chaqiruv (yangisi eskisini bekor qiladi); komponent yopilsa bekor bo'ladi. */
const useTimer = () => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );
  return useMemo(() => {
    const cancel = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
    return {
      cancel,
      schedule: (callback: () => void, delay: number) => {
        cancel();
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          callback();
        }, delay);
      },
    };
  }, []);
};

type ChipItem = { key: string; label: string; removeLabel: string; onRemove: () => void };

const FilterChip = ({ label, removeLabel, onRemove }: Omit<ChipItem, "key">) => (
  <span className={CHIP}>
    <span className="min-w-0 truncate">{label}</span>
    <Pressable aria-label={removeLabel} title={removeLabel} onClick={onRemove} className={CHIP_X}>
      <X aria-hidden="true" size={14} strokeWidth={2.25} />
    </Pressable>
  </span>
);

const OrderFilters = memo(({ statusTabs = true }: Props) => {
  const { t } = useTranslation(["orders", "ui", ORDER_STATUS_NS]);
  const dispatch = useDispatch();
  const { getParam, setMultipleParams } = useQueryParams();
  const role = useSelector((state: RootState) => state.role.role);
  const isPhone = useIsPhone();
  const panelId = useId();

  const scope = getOrderFilterScope(role);
  // Market tomoni (market va market operatori, MO-3) — bir xil asboblar qatori (maket `market-orders-list`).
  const isMarketRole = isMarketSideRole(role);
  const isManagerRole = role === "manager";
  const isRegistrator = role === "registrator";
  // Menejer va marketda sana telefonda ham asboblar qatorida (maket); qolganlarda — varaqada.
  const dateOnPhoneToolbar = isMarketRole || isManagerRole;
  const dateInSheet = isPhone && !dateOnPhoneToolbar;

  // ─── URL — yagona manba (browser back/forward'da Redux eskirib qolishi mumkin) ───
  const urlStatus = getParam(ORDER_STATUS_URL_KEY) ?? getParam(LEGACY_ORDER_STATUS_URL_KEY) ?? "";
  const values = useMemo<OrderFilterValues>(() => {
    const deliveryType = getParam(ORDER_FILTER_KEYS.deliveryType) ?? "";
    const fulfillmentSource = getParam(ORDER_FILTER_KEYS.fulfillmentSource) ?? "";
    return {
      marketId: getParam(ORDER_FILTER_KEYS.marketId) ?? "",
      branchId: getParam(ORDER_FILTER_KEYS.branchId) ?? "",
      regionId: getParam(ORDER_FILTER_KEYS.regionId) ?? "",
      districtId: getParam(ORDER_FILTER_KEYS.districtId) ?? "",
      courierId: getParam(ORDER_FILTER_KEYS.courierId) ?? "",
      deliveryType: isDeliveryType(deliveryType) ? deliveryType : "",
      fulfillmentSource: isFulfillmentSource(fulfillmentSource) ? fulfillmentSource : "",
      statuses: parseStatusValues(urlStatus),
      // Noto'g'ri sana (`?startDay=falonchi`) — filtr yo'q (sahifa API'ga ham yubormaydi, D-08).
      dateFrom: sanitizeDayParam(getParam(ORDER_FILTER_KEYS.dateFrom) ?? getParam(LEGACY_DATE_FROM_KEY)),
      dateTo: sanitizeDayParam(getParam(ORDER_FILTER_KEYS.dateTo) ?? getParam(LEGACY_DATE_TO_KEY)),
    };
  }, [getParam, urlStatus]);
  // Qo'llangan qidiruv (sahifa API'ga shuni yuboradi): bo'shliqlarsiz, boshidagi «№» / «#» siz (D-11).
  const search = normalizeOrderSearch(getParam(ORDER_FILTER_KEYS.search));

  // Holat tab orqali tanlanganmi (tab to'plamiga aynan mos) — unda u «Filtrlar» soniga va chiplarga kirmaydi.
  const statusFromTab = statusTabs && values.statuses.length > 0 && matchOrderStatusTab(values.statuses) !== null;
  const statusIsFilter = values.statuses.length > 0 && !statusFromTab;
  const panelCount = countPanelFilters(values, scope, { includeStatus: statusIsFilter });
  // Telefonda sana varaqada bo'lsa — u ham «Filtrlar N» soniga kiradi (maket: «Filtrlar 3» = sana + 2).
  const buttonCount = panelCount + Number(dateInSheet && hasDateRange(values));

  const options = useOrderFilterOptions(role, values.regionId);

  // ─── Panel (desktop/planshet) va varaqa (telefon) ─────────────────────
  // Panel faol filtr bo'lsa ochiq boshlanadi (maket `superadmin-orders-list`), aks holda yig'iq.
  const [panelOpen, setPanelOpen] = useState(() => panelCount > 0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [prevIsPhone, setPrevIsPhone] = useState(isPhone);
  if (prevIsPhone !== isPhone) {
    // Ekran telefondan kattalashsa varaqa yopiladi (qayta kichraysa o'zi ochilib ketmasin).
    setPrevIsPhone(isPhone);
    setSheetOpen(false);
  }

  // ─── Qidiruv: yozish kechikish bilan, tozalash / Enter — darhol ────────
  const [searchText, setSearchText] = useState(search);
  const [prevSearch, setPrevSearch] = useState(search);
  if (prevSearch !== search) {
    // URL tashqaridan o'zgardi (tozalash, back/forward) — maydon ham. O'zimiz yozgan qiymat bo'lsa (maydonda
    // «№53» yoki oxirida bo'shliq bilan «Ali » — qo'llangani «53» / «Ali») yozilayotgan matn o'zgarmaydi.
    setPrevSearch(search);
    if (normalizeOrderSearch(searchText) !== search) setSearchText(search);
  }
  const searchTimer = useTimer();
  const cancelPendingSearch = searchTimer.cancel;

  // ─── Yozish: Redux ko'zgusi + URL (bitta atomar yangilanish) ──────────
  const write = (params: Record<string, string>, redux: Partial<Record<keyof typeof ORDER_FILTER_KEYS, string | string[]>>) => {
    for (const [key, value] of Object.entries(redux)) {
      dispatch(setFilterValue({ key: ORDER_FILTER_KEYS[key as keyof typeof ORDER_FILTER_KEYS], value: value ?? "" }));
    }
    setMultipleParams(params);
  };

  const updateField = (key: "marketId" | "branchId" | "courierId" | "deliveryType" | "fulfillmentSource", value: string) =>
    write({ [ORDER_FILTER_KEYS[key]]: value }, { [key]: value });

  // Viloyat (menejerda tuman) o'zgarsa kuryer tanlovi tozalanadi — kuryerlar ro'yxati shunga bog'liq.
  const updateRegion = (value: string) =>
    write(
      { [ORDER_FILTER_KEYS.regionId]: value, [ORDER_FILTER_KEYS.courierId]: "" },
      { regionId: value, courierId: "" },
    );
  const updateDistrict = (value: string) =>
    write(
      { [ORDER_FILTER_KEYS.districtId]: value, [ORDER_FILTER_KEYS.courierId]: "" },
      { districtId: value, courierId: "" },
    );

  const updateStatus = (next: readonly string[]) => {
    const normalized = normalizeFilterStatuses(next);
    // Ikki ketma-ket URL yozuvi bir render ichida bir-birini bekor qilmasin — holat va eski kalit birga.
    write(
      // BG4: holat o'zgarsa «Bekor qilingan» tabidagi bosqich chipi ham tozalanadi.
      { [ORDER_STATUS_URL_KEY]: normalized.join(","), [LEGACY_ORDER_STATUS_URL_KEY]: "", [ORDER_CANCEL_STAGE_URL_KEY]: "" },
      { status: normalized },
    );
  };

  const updateDateRange = (from: string, to: string) =>
    write(
      {
        [ORDER_FILTER_KEYS.dateFrom]: from,
        [ORDER_FILTER_KEYS.dateTo]: to,
        [LEGACY_DATE_FROM_KEY]: "",
        [LEGACY_DATE_TO_KEY]: "",
      },
      { dateFrom: from, dateTo: to },
    );

  const updateSearch = (raw: string) => {
    const value = normalizeOrderSearch(raw);
    dispatch(setSearchValue({ key: ORDER_FILTER_KEYS.search, value }));
    setMultipleParams({ [ORDER_FILTER_KEYS.search]: value });
  };
  const commitSearch = (value: string) => {
    cancelPendingSearch();
    setSearchText(value);
    updateSearch(value);
  };
  // Kechikkan yozuv ENG SO'NGGI `updateSearch` ni chaqiradi: `setSearchParams` render paytidagi URL nusxasidan
  // quradi — eski yopilma kutish orasida o'zgargan filtr/tab/sahifani qaytarib yozardi.
  const updateSearchRef = useRef(updateSearch);
  useEffect(() => {
    updateSearchRef.current = updateSearch;
  });
  const handleSearchInput = (raw: string) => {
    const next = normalizePossibleScanValue(raw);
    setSearchText(next);
    searchTimer.schedule(() => updateSearchRef.current(next), SEARCH_DEBOUNCE_MS);
  };

  // ─── «Filtrlarni tozalash»: barcha filtr, sana va qidiruv; tab bilan tanlangan holat qoladi ───
  const handleReset = () => {
    cancelPendingSearch();
    dispatch(resetFilters());
    dispatch(clearAllSearch());
    if (statusFromTab) dispatch(setFilterValue({ key: ORDER_FILTER_KEYS.status, value: values.statuses }));
    setMultipleParams({
      [ORDER_FILTER_KEYS.marketId]: "",
      [ORDER_FILTER_KEYS.branchId]: "",
      [ORDER_FILTER_KEYS.regionId]: "",
      [ORDER_FILTER_KEYS.districtId]: "",
      [ORDER_FILTER_KEYS.courierId]: "",
      [ORDER_FILTER_KEYS.deliveryType]: "",
      [ORDER_FILTER_KEYS.fulfillmentSource]: "",
      ...(statusFromTab ? {} : { [ORDER_STATUS_URL_KEY]: "" }),
      [LEGACY_ORDER_STATUS_URL_KEY]: "",
      [ORDER_CANCEL_STAGE_URL_KEY]: "",
      [ORDER_FILTER_KEYS.dateFrom]: "",
      [ORDER_FILTER_KEYS.dateTo]: "",
      [LEGACY_DATE_FROM_KEY]: "",
      [LEGACY_DATE_TO_KEY]: "",
      [ORDER_FILTER_KEYS.search]: "",
    });
    setSearchText("");
  };

  // ─── Varaqa: qoralama bir marta yoziladi ───────────────────────────────
  const applySheet = (draft: OrderFilterValues) => {
    const params: Record<string, string> = {
      [ORDER_FILTER_KEYS.marketId]: draft.marketId,
      [ORDER_FILTER_KEYS.branchId]: draft.branchId,
      [ORDER_FILTER_KEYS.regionId]: draft.regionId,
      [ORDER_FILTER_KEYS.districtId]: draft.districtId,
      [ORDER_FILTER_KEYS.courierId]: draft.courierId,
      [ORDER_FILTER_KEYS.deliveryType]: draft.deliveryType,
      [ORDER_FILTER_KEYS.fulfillmentSource]: scope.source ? (draft.fulfillmentSource ?? "") : "",
      [ORDER_STATUS_URL_KEY]: draft.statuses.join(","),
      [LEGACY_ORDER_STATUS_URL_KEY]: "",
      [ORDER_CANCEL_STAGE_URL_KEY]: "",
    };
    const redux: Partial<Record<keyof typeof ORDER_FILTER_KEYS, string | string[]>> = {
      marketId: draft.marketId,
      branchId: draft.branchId,
      regionId: draft.regionId,
      districtId: draft.districtId,
      courierId: draft.courierId,
      deliveryType: draft.deliveryType,
      fulfillmentSource: scope.source ? (draft.fulfillmentSource ?? "") : "",
      status: draft.statuses,
    };
    if (dateInSheet) {
      Object.assign(params, {
        [ORDER_FILTER_KEYS.dateFrom]: draft.dateFrom,
        [ORDER_FILTER_KEYS.dateTo]: draft.dateTo,
        [LEGACY_DATE_FROM_KEY]: "",
        [LEGACY_DATE_TO_KEY]: "",
      });
      Object.assign(redux, { dateFrom: draft.dateFrom, dateTo: draft.dateTo });
    }
    write(params, redux);
  };

  // ─── Variantlar ────────────────────────────────────────────────────────
  const all = t("select.all", { ns: "ui" });
  const withAll = (items: FilterOption[]) => [{ value: "", label: all }, ...items];
  const nameOf = (items: FilterOption[], id: string) => items.find((item) => item.value === id)?.label ?? `#${id}`;
  const statusLabel = (status: OrderStatus) => t(ORDER_STATUS_REGISTRY[status].labelKey, { ns: ORDER_STATUS_NS });
  const statusOptions = FILTER_STATUSES.map((status) => ({ value: status, label: statusLabel(status) }));
  const deliveryOptions = [
    { value: "", label: all },
    { value: "address", label: t("deliveryToHome") },
    { value: "center", label: t("deliveryToCenter") },
  ];
  const deliveryLabel = (value: string) => deliveryOptions.find((item) => item.value === value)?.label ?? value;
  // 6kHnNH9j: «Manba» — maket yo'q (eng yaqini «Yetkazish turi» filtri).
  const sourceOptions = [
    { value: "", label: all },
    { value: "WAREHOUSE", label: t("fulfillment.filterWarehouse") },
    { value: "HQ", label: t("fulfillment.filterHq") },
  ];
  const sourceLabel = (value: string) => sourceOptions.find((item) => item.value === value)?.label ?? value;

  // ─── Chiplar (maket tartibi: sana · market · filial · viloyat/tuman · kuryer · yetkazish · holat · qidiruv) ───
  const chip = (label: string, value: string) => t("filters.chip", { ns: "ui", label, value });
  const removeLabel = (label: string) => t("filters.remove", { ns: "ui", label });
  const chips: ChipItem[] = [];
  if (dateInSheet && hasDateRange(values)) {
    const range = { from: values.dateFrom, to: values.dateTo };
    chips.push({
      key: "date",
      label:
        formatRangeShort(range) ??
        (range.from
          ? t("date.fromOnly", { ns: "ui", date: formatDay(range.from) })
          : t("date.toOnly", { ns: "ui", date: formatDay(range.to) })),
      removeLabel: removeLabel(t("date.dateLabel", { ns: "ui" })),
      onRemove: () => updateDateRange("", ""),
    });
  }
  if (scope.market && values.marketId) {
    chips.push({
      key: "market",
      label: chip(t("chipMarket"), nameOf(options.markets, values.marketId)),
      removeLabel: removeLabel(t("chipMarket")),
      onRemove: () => updateField("marketId", ""),
    });
  }
  if (scope.branch && values.branchId) {
    chips.push({
      key: "branch",
      label: chip(t("chipBranch"), nameOf(options.branches, values.branchId)),
      removeLabel: removeLabel(t("chipBranch")),
      onRemove: () => updateField("branchId", ""),
    });
  }
  if (scope.area === "district" && values.districtId) {
    chips.push({
      key: "district",
      label: chip(t("district"), nameOf(options.districts, values.districtId)),
      removeLabel: removeLabel(t("district")),
      onRemove: () => updateDistrict(""),
    });
  }
  if (scope.area === "region" && values.regionId) {
    chips.push({
      key: "region",
      label: chip(t("chipRegion"), nameOf(options.regions, values.regionId)),
      removeLabel: removeLabel(t("chipRegion")),
      onRemove: () => updateRegion(""),
    });
  }
  if (scope.courier && values.courierId) {
    chips.push({
      key: "courier",
      label: chip(t("chipCourier"), nameOf(options.couriers, values.courierId)),
      removeLabel: removeLabel(t("chipCourier")),
      onRemove: () => updateField("courierId", ""),
    });
  }
  if (values.deliveryType) {
    chips.push({
      key: "delivery",
      label: chip(t("deliveryType"), deliveryLabel(values.deliveryType)),
      removeLabel: removeLabel(t("deliveryType")),
      onRemove: () => updateField("deliveryType", ""),
    });
  }
  if (scope.source && values.fulfillmentSource) {
    chips.push({
      key: "source",
      label: chip(t("fulfillment.filter"), sourceLabel(values.fulfillmentSource)),
      removeLabel: removeLabel(t("fulfillment.filter")),
      onRemove: () => updateField("fulfillmentSource", ""),
    });
  }
  if (statusIsFilter) {
    for (const status of values.statuses) {
      const label = statusLabel(status);
      chips.push({
        key: `status-${status}`,
        label: chip(t("chipStatus"), label),
        removeLabel: removeLabel(chip(t("chipStatus"), label)),
        onRemove: () => updateStatus(values.statuses.filter((item) => item !== status)),
      });
    }
  }
  if (search) {
    chips.push({
      key: "search",
      label: t("filters.searchChip", { ns: "ui", label: t("chipSearch"), value: search }),
      removeLabel: removeLabel(t("chipSearch")),
      onRemove: () => commitSearch(""),
    });
  }

  // ─── Joylashuv (maketlar): qidiruv va guruh asoslari rolga qarab ──────
  const searchBasis = isMarketRole ? "flex-[1_1_320px]" : isManagerRole ? "flex-[1_1_280px]" : "flex-[1_1_240px]";
  const groupBasis = isMarketRole ? "flex-[1_1_330px]" : "flex-[1_1_360px]";
  const panelGrid = isRegistrator
    ? "grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))]"
    : isManagerRole
      ? "grid-cols-[repeat(auto-fit,minmax(min(150px,100%),1fr))]"
      : "grid-cols-[repeat(auto-fit,minmax(min(160px,100%),1fr))]";
  // Telefonda sana chipi bo'lgan qator (superadmin, admin, registrator) — bir qatorda, yonga suriladi.
  const chipsScroll = dateInSheet;
  // Matn va son orasida 8 px (maketdagi `.el-btn` oralig'i), son markazda.
  const filtersLabel = (count: number) => (
    <span className="inline-flex items-center gap-2">
      {t("filters.button", { ns: "ui" })}
      {count > 0 ? <span className={COUNT_PILL}>{formatNumberLocalized(count)}</span> : null}
    </span>
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <TextInput
          mode="search"
          value={searchText}
          onValueChange={handleSearchInput}
          onClear={() => commitSearch("")}
          onSearch={(value) => commitSearch(normalizePossibleScanValue(value))}
          placeholder={t(isRegistrator ? "listFilters.searchPlaceholderFull" : "listFilters.searchPlaceholder")}
          aria-label={t("listFilters.searchLabel")}
          className={searchBasis}
        />
        <div className={cx("flex min-w-0 max-w-[420px] flex-wrap gap-3", groupBasis)}>
          {!isPhone || dateOnPhoneToolbar ? (
            <DateRange
              value={{ from: values.dateFrom, to: values.dateTo }}
              onChange={({ from, to }) => updateDateRange(from, to)}
              placeholder={t("date.rangeLabel", { ns: "ui" })}
              // Kamida 210 px (maket `manager-orders-list-*`): telefonda oraliq to'liq ko'rinsin — sig'masa «Filtrlar»
              // keyingi qatorga o'tadi (telefonda maydon shrifti 16 px va × tugmasi 44 px — maketdagidan kengroq).
              className="min-w-[210px] flex-[1_1_200px]"
              triggerClassName="whitespace-nowrap"
            />
          ) : null}
          {/* Ochiq holat — maket `.el-btn-secondary.is-active` (`--border` fon), kursor ustida ham saqlanadi. */}
          {isPhone ? (
            <Button
              variant="secondary"
              leftIcon={ListFilter}
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              onClick={() => setSheetOpen(true)}
              className="flex-[1_0_auto] aria-expanded:bg-border!"
            >
              {filtersLabel(buttonCount)}
            </Button>
          ) : (
            <Button
              variant="secondary"
              leftIcon={ListFilter}
              aria-expanded={panelOpen}
              aria-controls={panelId}
              onClick={() => setPanelOpen((open) => !open)}
              className="flex-[1_0_auto] aria-expanded:bg-border!"
            >
              {filtersLabel(panelCount)}
            </Button>
          )}
        </div>
      </div>

      {!isPhone ? (
        <div id={panelId} hidden={!panelOpen} className="px-5 pb-4">
          <div
            role="group"
            aria-label={t("filters.panel", { ns: "ui" })}
            className={cx("grid gap-3 rounded-xl bg-sunken p-4", panelGrid)}
          >
            {scope.marketSelect ? (
              <Field label={t("filterMarket")} labelAs="span">
                <Select
                  searchable
                  options={withAll(options.markets)}
                  value={values.marketId}
                  onChange={(next) => updateField("marketId", next ?? "")}
                  placeholder={all}
                  loading={options.marketsLoading}
                />
              </Field>
            ) : null}
            {scope.branch ? (
              <Field label={t("filterBranch")} labelAs="span">
                <Select
                  searchable
                  options={withAll(options.branches)}
                  value={values.branchId}
                  onChange={(next) => updateField("branchId", next ?? "")}
                  placeholder={all}
                  loading={options.branchesLoading}
                />
              </Field>
            ) : null}
            {scope.area === "none" ? null : scope.area === "district" ? (
              <Field label={t("district")} labelAs="span">
                <Select
                  searchable
                  options={withAll(options.districts)}
                  value={values.districtId}
                  onChange={(next) => updateDistrict(next ?? "")}
                  placeholder={all}
                  loading={options.districtsLoading}
                />
              </Field>
            ) : (
              <Field label={t("filterRegion")} labelAs="span">
                <Select
                  searchable
                  options={withAll(options.regions)}
                  value={values.regionId}
                  onChange={(next) => updateRegion(next ?? "")}
                  placeholder={all}
                  loading={options.regionsLoading}
                />
              </Field>
            )}
            {scope.courier ? (
              <Field label={t("filterCourier")} labelAs="span">
                <Select
                  searchable
                  options={withAll(options.couriers)}
                  value={values.courierId}
                  onChange={(next) => updateField("courierId", next ?? "")}
                  placeholder={all}
                  loading={options.couriersLoading}
                />
              </Field>
            ) : null}
            <Field label={t("deliveryType")} labelAs="span">
              <Select
                options={deliveryOptions}
                value={values.deliveryType}
                onChange={(next) => updateField("deliveryType", next && isDeliveryType(next) ? next : "")}
                placeholder={all}
              />
            </Field>
            {scope.source ? (
              <Field label={t("fulfillment.filter")} labelAs="span">
                <Select
                  options={sourceOptions}
                  value={values.fulfillmentSource ?? ""}
                  onChange={(next) => updateField("fulfillmentSource", next && isFulfillmentSource(next) ? next : "")}
                  placeholder={all}
                />
              </Field>
            ) : null}
            <Field label={t("filterStatus")} labelAs="span">
              {/* Bitta holat — nomi; bir nechta — «N ta tanlangan» (tor ustunda belgilar ikki qatorga o'tib panelni
                  cho'zardi; nomlari pastdagi chiplarda). */}
              <Select
                multiple
                multiDisplay={normalizeFilterStatuses(values.statuses).length > 1 ? "count" : "chips"}
                clearable
                options={statusOptions}
                value={values.statuses}
                onChange={updateStatus}
                placeholder={all}
              />
            </Field>
          </div>
        </div>
      ) : null}

      {chips.length > 0 ? (
        <div
          role="group"
          aria-label={t("filters.active", { ns: "ui" })}
          className={cx(
            "flex flex-wrap items-center gap-2 px-5 pb-4",
            // Skroll chizig'i yashirin (maket `scrollbar-width: none`): `scrollbar-hide` Tailwind v4 da utilita emas.
            chipsScroll &&
              "max-md:flex-nowrap max-md:overflow-x-auto max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden",
          )}
        >
          {chips.map(({ key, ...item }) => (
            <FilterChip key={key} {...item} />
          ))}
          <Button variant="link" size="sm" onClick={handleReset} className="shrink-0">
            {t("filters.clearAll", { ns: "ui" })}
          </Button>
        </div>
      ) : null}

      {isPhone ? (
        <OrderFiltersSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          initial={values}
          role={role}
          withDate={dateInSheet}
          search={search}
          onApply={applySheet}
        />
      ) : null}
    </>
  );
});

OrderFilters.displayName = "OrderFilters";

export default OrderFilters;
