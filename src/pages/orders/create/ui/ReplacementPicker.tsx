// dizayn-v2: (maket yo'q) superadmin-neworders-create-manual-step2, market-new-orders-create-manual
import { memo, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Calendar, ChevronDown, MessageSquare, Package, Phone, Repeat, SearchX, User, X } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  OrderStatusBadge,
  formatReplacementOrderRef,
  toReplaceableSearch,
  useReplaceableOrders,
  type ReplaceableOrderRow,
  type ReplaceableOrdersParams,
} from "../../../../entities/order";
import { cx } from "../../../../shared/lib/cx";
import { formatDateLocalized } from "../../../../shared/lib/formatDateTime";
import { formatMoneyLocalized } from "../../../../shared/lib/formatMoney";
import { formatPhone } from "../../../../shared/lib/formatPhone";
import { getOrderItemName } from "../../../../shared/lib/orderItemName";
import {
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  Pressable,
  Skeleton,
  TextInput,
  TONE_RING,
  TONE_SOFT,
  useFieldControl,
} from "../../../../shared/ui/primitives";
import type { OrderCreateFormValues, ReplacementSelection } from "../model/orderCreateForm";

/** Market roli va market operatori — doira tokendan (`market_id` yuborilmaydi); tanlov kaliti. */
export const OWN_MARKET_KEY = "own";
/** Bitta so'rovdagi qatorlar (BeePost kabi 30). Ko'p bo'lsa — «aniqroq qidiring». */
export const REPLACEABLE_LIMIT = 30;
/** Qidiruv kechikishi va eng qisqa so'rov (BeePost: 300 ms, 2 belgi). */
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_CHARS = 2;

/** Ro'yxat rejimi: qidiruv (market bo'ylab), tanlangan/yozilgan mijoz, mijoz yo'q — marketning so'nggilari. */
export type ReplaceableListMode = "search" | "customer" | "recent";

/**
 * So'rov parametrlari (BeePost `ReplacementPicker` qoidasi, bo'sh holat kengaytirilgan):
 *  - qidiruv (≥ 2 belgi): `q` (market bo'ylab — boshqa mijozniki ham); «EL-…» ichki id'ga aylanadi;
 *  - taklifdan tanlangan mavjud mijoz: `customer_id`;
 *  - telefon to'liq yozilgan (9 raqam): `q = +998…` (backend shu marketdagi mijozni telefon bo'yicha topadi);
 *  - aks holda — marketning so'nggi yetkazilgan buyurtmalari (BeePost bu holatda bo'sh ro'yxat berardi).
 * `market_id` — faqat market tomoni bo'lmagan rollarda.
 */
export const buildReplaceableParams = (input: {
  marketId: string | null;
  search: string;
  customerId: string | null;
  phoneDigits: string;
}): { mode: ReplaceableListMode; params: ReplaceableOrdersParams } => {
  const search = input.search.trim();
  const base: ReplaceableOrdersParams = input.marketId ? { market_id: input.marketId } : {};
  if (search.length >= SEARCH_MIN_CHARS) {
    return { mode: "search", params: { ...base, q: toReplaceableSearch(search), limit: REPLACEABLE_LIMIT } };
  }
  if (input.customerId) {
    return { mode: "customer", params: { ...base, customer_id: input.customerId, limit: REPLACEABLE_LIMIT } };
  }
  if (/^\d{9}$/.test(input.phoneDigits)) {
    return { mode: "customer", params: { ...base, q: `+998${input.phoneDigits}`, limit: REPLACEABLE_LIMIT } };
  }
  return { mode: "recent", params: { ...base, limit: REPLACEABLE_LIMIT } };
};

/** Yetkazilgan sana: `sold_at` (epoch ms matni), bo'lmasa yaratilgan sana. */
const rowDate = (row: Pick<ReplaceableOrderRow, "sold_at" | "createdAt">): string | null => row.sold_at ?? row.createdAt;

/** Sana qiymati (epoch ms matni yoki ISO) → «06.10.2026». */
export const formatReplacementDate = (value: string | null | undefined): string => {
  if (!value) return "—";
  return formatDateLocalized(/^\d{10,}$/.test(value) ? Number(value) : value);
};

export const toReplacementSelection = (row: ReplaceableOrderRow, marketKey: string): ReplacementSelection => ({
  id: row.id,
  marketKey,
  date: rowDate(row),
  customerName: row.customer?.name?.trim() || null,
});

/** `.el-option` — tanlash oynasidagi qator (telefonda ham ≥ 44 px). */
const ROW =
  "flex w-full min-w-0 cursor-pointer select-none flex-col gap-1.5 rounded-lg border px-3 py-2.5 text-left text-sm " +
  "text-text transition-[background-color,border-color] duration-150 motion-reduce:transition-none";

type ReplacementOptionProps = {
  row: ReplaceableOrderRow;
  id: string;
  active: boolean;
  onActivate: () => void;
  onSelect: () => void;
};

/** Variant: №, sana, holat · mijoz, telefon · mahsulotlar, summa · izoh (bir xil mahsulotni sana/izoh ajratadi). */
const ReplacementOption = ({ row, id, active, onActivate, onSelect }: ReplacementOptionProps) => {
  const { t, i18n } = useTranslation("orders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const unnamed = t("replacementPicker.unnamedProduct");
  const products = row.items
    .map((item) => t("replacementPicker.itemLine", { name: getOrderItemName(item, unnamed), quantity: item.quantity }))
    .join(", ");
  const date = formatReplacementDate(rowDate(row));

  return (
    <div
      id={id}
      role="option"
      aria-selected={false}
      data-active={active || undefined}
      onMouseMove={onActivate}
      onClick={onSelect}
      className={cx(ROW, active ? "border-action bg-sunken" : "border-border hover:bg-sunken")}
    >
      <span className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-semibold text-text">{formatReplacementOrderRef(row.id)}</span>
          <span
            className="flex items-center gap-1 text-xs text-text-muted"
            // `sold_at` bo'lmasa sana — yaratilgan kun (maslahat «Yetkazilgan sana» demaydi).
            title={row.sold_at ? t("replacementPicker.deliveredOn", { date }) : undefined}
          >
            <Calendar size={14} aria-hidden="true" className="shrink-0" />
            {date}
          </span>
        </span>
        <OrderStatusBadge status={row.status} size="sm" />
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-text-muted">
        <span className="flex min-w-0 items-center gap-1">
          <User size={14} aria-hidden="true" className="shrink-0" />
          <span className="truncate">{row.customer?.name?.trim() || t("replacementPicker.noCustomerName")}</span>
        </span>
        {row.customer?.phone_number ? (
          <span className="flex items-center gap-1 whitespace-nowrap">
            <Phone size={14} aria-hidden="true" className="shrink-0" />
            {formatPhone(row.customer.phone_number)}
          </span>
        ) : null}
      </span>
      <span className="flex min-w-0 items-start justify-between gap-2 text-[13px]">
        <span className="flex min-w-0 items-start gap-1 text-text-muted">
          <Package size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span className="min-w-0 break-words">{products || "—"}</span>
        </span>
        <span className="shrink-0 font-semibold whitespace-nowrap text-text">
          {formatMoneyLocalized(row.total_price, { language })}
        </span>
      </span>
      {row.comment ? (
        <span className="flex min-w-0 items-start gap-1 border-t border-border pt-1.5 text-[13px] text-warning-fg">
          <MessageSquare size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span className="min-w-0 break-words">{row.comment}</span>
        </span>
      ) : null}
    </div>
  );
};

type ReplacementPickerDialogProps = {
  open: boolean;
  /** `market_id` (market tomoni bo'lmagan rollar); market tomonida — `null` (server tokendan). */
  marketId: string | null;
  /** Market tomoni: market ma'lum (token) — so'rov `market_id` siz ketadi. */
  ownMarket: boolean;
  customerId: string | null;
  phoneDigits: string;
  onClose: () => void;
  onSelect: (row: ReplaceableOrderRow) => void;
};

/**
 * ESKI BUYURTMANI TANLASH OYNASI — `MarketPickerDialog` naqshi: `Dialog` xl (telefonda pastki varaqa), qidiruv
 * («Telefon yoki buyurtma raqami bo'yicha qidirish...», ochilganda fokus shu yerda), rejim izohi, `listbox`
 * (eng ko'pi 440 px, ichida aylanadi). Qatorni bosish darhol tanlaydi va yopadi.
 *
 * Klaviatura (fokus qidiruvda, `aria-activedescendant`): ↑ ↓ Home End — ro'yxatda yurish, Enter — tanlash.
 */
export const ReplacementPickerDialog = ({
  open,
  marketId,
  ownMarket,
  customerId,
  phoneDigits,
  onClose,
  onSelect,
}: ReplacementPickerDialogProps) => {
  const { t } = useTranslation(["orders", "common"]);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const { mode, params } = useMemo(
    () => buildReplaceableParams({ marketId, search: debounced, customerId, phoneDigits }),
    [customerId, debounced, marketId, phoneDigits],
  );
  const result = useReplaceableOrders(params, open && (ownMarket || Boolean(marketId)));
  const rows = useMemo(() => result.data?.items ?? [], [result.data]);
  const total = result.data?.total ?? 0;
  const loading = result.isPending && result.fetchStatus !== "idle";
  const typing = query.trim() !== debounced;

  const optionId = (index: number) => `${listId}-option-${encodeURIComponent(rows[index]?.id ?? String(index))}`;
  const current = activeIndex >= 0 && activeIndex < rows.length ? activeIndex : -1;

  const move = (index: number) => {
    if (rows.length === 0) return;
    const next = (index + rows.length) % rows.length;
    setActiveIndex(next);
    document.getElementById(optionId(next))?.scrollIntoView?.({ block: "nearest" });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(current < 0 ? 0 : current + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(current < 0 ? rows.length - 1 : current - 1);
        break;
      case "Home":
      case "End":
        if (rows.length === 0) return;
        event.preventDefault();
        move(event.key === "Home" ? 0 : rows.length - 1);
        break;
      case "Enter": {
        // Sahifa formasi yuborilmasin — Enter faqat faol qatorni tanlaydi.
        event.preventDefault();
        const row = rows[current];
        if (row) onSelect(row);
        break;
      }
      default:
        break;
    }
  };

  const reset = () => {
    setQuery("");
    setDebounced("");
    setActiveIndex(-1);
  };

  const modeHint =
    mode === "search"
      ? t("replacementPicker.hintSearch")
      : mode === "customer"
        ? t("replacementPicker.hintCustomer")
        : t("replacementPicker.hintRecent");
  const emptyText =
    mode === "search"
      ? t("replacementPicker.emptySearch")
      : mode === "customer"
        ? t("replacementPicker.emptyCustomer")
        : t("replacementPicker.emptyRecent");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onExited={reset}
      size="xl"
      icon={Repeat}
      iconTone="warning"
      title={t("replacementPicker.dialogTitle")}
      description={t("replacementPicker.dialogDescription")}
    >
      <TextInput
        mode="search"
        value={query}
        onValueChange={(next) => {
          setQuery(next);
          setActiveIndex(-1);
        }}
        placeholder={t("replacementPicker.searchPlaceholder")}
        aria-label={t("replacementPicker.searchAria")}
        role="combobox"
        aria-expanded
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={current >= 0 ? optionId(current) : undefined}
        autoComplete="off"
        onKeyDown={handleKeyDown}
      />
      <p className="m-0 text-[13px] text-text-muted" data-testid="replacement-mode-hint">
        {modeHint}
      </p>
      <div className="flex min-h-0 flex-col border-t border-border pt-2">
        {result.isError ? (
          <ErrorState
            size="inline"
            error={result.error}
            onRetry={() => void result.refetch()}
            retrying={result.isFetching}
          />
        ) : (
          <div
            id={listId}
            role="listbox"
            aria-label={t("replacementPicker.listLabel")}
            aria-busy={loading || typing || undefined}
            // Bosilganda fokus qidiruv maydonida qoladi (`aria-activedescendant`).
            onMouseDown={(event) => event.preventDefault()}
            className="-mx-1 flex max-h-[440px] min-h-0 flex-col gap-2 overflow-y-auto overscroll-contain px-1 py-0.5"
          >
            {loading
              ? Array.from({ length: 3 }, (_, index) => (
                  <div
                    key={index}
                    role="presentation"
                    className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2.5"
                  >
                    <Skeleton width="45%" />
                    <Skeleton width="60%" />
                    <Skeleton width="80%" />
                  </div>
                ))
              : rows.map((row, index) => (
                  <ReplacementOption
                    key={row.id}
                    row={row}
                    id={optionId(index)}
                    active={index === current}
                    onActivate={() => {
                      if (index !== current) setActiveIndex(index);
                    }}
                    onSelect={() => onSelect(row)}
                  />
                ))}
            {!loading && rows.length === 0 ? (
              <div role="presentation">
                <EmptyState size="inline" icon={SearchX} title={emptyText} />
              </div>
            ) : null}
          </div>
        )}
        {!loading && !result.isError && total > rows.length ? (
          <p className="m-0 pt-2 text-center text-[13px] text-text-muted" role="status">
            {t("replacementPicker.more", { shown: rows.length, total })}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
};

type ReplacementTriggerProps = { open: boolean; disabled: boolean; onOpen: () => void };

/** Maydon ko'rinishidagi tugma: `Repeat` · «Almashtirish uchun — eski buyurtmani tanlash» · chevron (matn o'raladi). */
const ReplacementTrigger = ({ open, disabled, onOpen }: ReplacementTriggerProps) => {
  const { t } = useTranslation("orders");
  const field = useFieldControl({ disabled });
  const textId = useId();
  return (
    <Pressable
      id={field.id}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-labelledby={field.labelId ? `${field.labelId} ${textId}` : textId}
      aria-describedby={field["aria-describedby"]}
      aria-invalid={field["aria-invalid"]}
      disabled={disabled}
      onClick={onOpen}
      className={cx(
        "flex min-h-11 w-full min-w-0 items-center gap-2 rounded-[10px] border bg-input px-3 py-2 text-left text-sm font-semibold",
        "transition-[background-color,border-color,box-shadow] duration-150 motion-reduce:transition-none",
        disabled
          ? "cursor-not-allowed border-border bg-sunken text-text-subtle"
          : open
            ? "border-action text-action-fg ring-3 ring-focus"
            : field.invalid
              ? "border-danger text-action-fg"
              : "border-border-strong text-action-fg hover:border-text-subtle",
      )}
    >
      <Repeat size={16} aria-hidden="true" className="shrink-0" />
      <span id={textId} className="min-w-0 flex-1 break-words">
        {t("replacementPicker.open")}
      </span>
      <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-text-subtle" />
    </Pressable>
  );
};

type ReplacementChipProps = { value: ReplacementSelection; onCancel: () => void };

/** Tanlangan eski buyurtma: «Eski №EL-… (sana) — mijoz almashtirilmoqda» + «Bekor qilish». */
const ReplacementChip = ({ value, onCancel }: ReplacementChipProps) => {
  const { t } = useTranslation("orders");
  const field = useFieldControl();
  const values = { ref: formatReplacementOrderRef(value.id), date: formatReplacementDate(value.date) };
  const text = value.customerName
    ? t("replacementPicker.selected", { ...values, customer: value.customerName })
    : t("replacementPicker.selectedNoCustomer", values);
  return (
    <div
      role="group"
      aria-labelledby={field.labelId}
      aria-describedby={field["aria-describedby"]}
      data-testid="replacement-selected"
      className={cx(
        "flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-[10px] py-1.5 pr-1.5 pl-3",
        TONE_SOFT.warning,
        TONE_RING.warning,
      )}
    >
      <span className="flex min-w-0 flex-[1_1_160px] items-start gap-2 py-1 text-[13px] font-semibold">
        <Repeat size={16} aria-hidden="true" className="mt-px shrink-0" />
        <span className="min-w-0 break-words">{text}</span>
      </span>
      <Button
        variant="ghost"
        size="sm"
        leftIcon={X}
        aria-label={t("replacementPicker.cancelAria", values)}
        onClick={onCancel}
        className="max-md:h-11"
      >
        {t("replacementPicker.cancel")}
      </Button>
    </div>
  );
};

type ReplacementFieldProps = {
  /** Market tomoni (market, market operatori): doira tokendan — `market_id` yuborilmaydi. */
  isMarketRole: boolean;
};

/**
 * «ALMASHTIRISH (ixtiyoriy)» — BeePost `create-order/ReplacementPicker` (lQjt6sKP). Maket yo'q — eng yaqini
 * `*-create-manual-step2` xulosa kartasi: «Operator» dan keyin, «Buyurtma yaratish» dan oldin (BeePost'da ham Operator
 * va Izoh dan keyin, tugmalardan oldin). Yon ustun tor va yopishqoq (`lg:sticky`) — ro'yxat ichida ochilsa ustun
 * ekrandan oshib ketardi, shuning uchun ro'yxat oynada (`ReplacementPickerDialog`, telefonda pastki varaqa).
 *
 * Holatlar: tanlanmagan — maydon-tugma «Almashtirish uchun — eski buyurtmani tanlash»; tanlangan — sariq chip va
 * «Bekor qilish»; backend 400 (eski buyurtma topilmadi / yetkazilmagan / allaqachon almashtirilgan) — maydon ostida.
 * Market almashsa (boshqa market tanlansa) tanlov tozalanadi — eski buyurtma faqat shu market doirasidan.
 */
export const ReplacementField = memo(({ isMarketRole }: ReplacementFieldProps) => {
  const { t } = useTranslation("orders");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const {
    control,
    setValue,
    clearErrors,
    formState: { errors },
  } = useFormContext<OrderCreateFormValues>();
  const market = useWatch({ control, name: "market" });
  const value = useWatch({ control, name: "replacement" });
  const existingCustomer = useWatch({ control, name: "existingCustomer" });
  const phoneDigits = useWatch({ control, name: "customer.phone" }) ?? "";
  const marketId = !isMarketRole && market ? String(market.id) : null;
  const marketKey = isMarketRole ? OWN_MARKET_KEY : marketId;

  // Boshqa market (yoki market tozalandi) — eski market buyurtmasi yangi market buyurtmasiga bog'lanmaydi.
  useEffect(() => {
    if (value && value.marketKey !== marketKey) {
      setValue("replacement", null, { shouldDirty: true });
      clearErrors("replacement");
    }
  }, [clearErrors, marketKey, setValue, value]);

  const select = (row: ReplaceableOrderRow) => {
    if (!marketKey) return;
    clearErrors("replacement");
    setValue("replacement", toReplacementSelection(row, marketKey), { shouldDirty: true });
    setOpen(false);
  };

  const cancel = () => {
    clearErrors("replacement");
    setValue("replacement", null, { shouldDirty: true });
    // Chip yo'qoladi — fokus maydon-tugmaga (klaviatura bilan ishlovchi joyini yo'qotmasin).
    window.requestAnimationFrame(() => wrapRef.current?.querySelector("button")?.focus());
  };

  const disabled = !marketKey;

  return (
    <>
      <Field
        id="replacement"
        label={t("replacementPicker.label")}
        optional
        labelAs="span"
        hint={disabled ? t("replacementPicker.noMarket") : t("replacementPicker.hint")}
        error={errors.replacement?.message}
        disabled={disabled}
      >
        <div ref={wrapRef} className="min-w-0">
          {value ? (
            <ReplacementChip value={value} onCancel={cancel} />
          ) : (
            <ReplacementTrigger open={open} disabled={disabled} onOpen={() => setOpen(true)} />
          )}
        </div>
      </Field>
      {/* `Field` dan TASHQARIDA: oynadagi qidiruv maydoni «Almashtirish» yorlig'i/id'sini (kontekst) olib qolmasin. */}
      <ReplacementPickerDialog
        open={open}
        marketId={marketId}
        ownMarket={isMarketRole}
        customerId={existingCustomer?.id ?? null}
        phoneDigits={phoneDigits}
        onClose={() => setOpen(false)}
        onSelect={select}
      />
    </>
  );
});

ReplacementField.displayName = "ReplacementField";

export default ReplacementField;
