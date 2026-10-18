// dizayn-v2: superadmin-neworders-create-manual-step1, superadmin-neworders-create-market-picker-dialog, admin-neworders-create-manual, admin-neworders-create-market-picker, manager-new-orders-create-manual-step1, registrator-new-orders-create-step1, registrator-new-orders-create-market-picker-dialog
import { memo, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, ChevronUp, Phone, Store, X } from "lucide-react";
import { useController, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useMarkets } from "../../../../entities/markets";
import { cx } from "../../../../shared/lib/cx";
import { formatPhone } from "../../../../shared/lib/formatPhone";
import {
  Button,
  Dialog,
  Field,
  Pressable,
  Skeleton,
  TextInput,
  useFieldControl,
} from "../../../../shared/ui/primitives";
import type { MarketOption, OrderCreateFormValues } from "../model/orderCreateForm";

const getMarketPhone = (market?: MarketOption | null) => market?.phone_number ?? market?.phone ?? "";

const isActiveMarket = (market: MarketOption) => market.status !== "inactive" && market.status !== "blocked";

/** API javobidan marketlar ro'yxati: `[]` · `{ data: [] }` · `{ data: { items: [] } }` · `{ items: [] }`. */
const toMarketList = (value: unknown): MarketOption[] => {
  if (Array.isArray(value)) return value as MarketOption[];
  if (typeof value !== "object" || value === null) return [];
  const record = value as { data?: unknown; items?: unknown };
  if (Array.isArray(record.data)) return record.data as MarketOption[];
  const nested = record.data as { items?: unknown } | undefined;
  if (nested && Array.isArray(nested.items)) return nested.items as MarketOption[];
  if (Array.isArray(record.items)) return record.items as MarketOption[];
  return [];
};

/** Qidiruv kechikishi (avvalgidek 350 ms) — har harf uchun so'rov ketmasin. */
const SEARCH_DEBOUNCE_MS = 350;

/** `.el-option` — tanlash oynasidagi qator (telefonda ≥ 44 px, maketda 56). */
const ROW =
  "flex min-h-14 w-full cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-text " +
  "transition-[background-color] duration-150 motion-reduce:transition-none";

type MarketPickerDialogProps = {
  open: boolean;
  selected: MarketOption | null;
  onClose: () => void;
  onSelect: (market: MarketOption) => void;
};

/**
 * MARKET TANLASH OYNASI — maket `*-create-market-picker-dialog`: `Dialog` xl (640 px; telefonda pastki varaqa),
 * ikonka `Store`, sarlavha «Market tanlash», izoh; «Market qidirish...» (ochilganda fokus shu yerda);
 * `listbox` «Marketlar» (eng ko'pi 400 px, ichida aylanadi). Qatorni bosish darhol tanlaydi va yopadi.
 *
 * Klaviatura (fokus qidiruvda, `aria-activedescendant`): ↑ ↓ Home End — ro'yxatda yurish, Enter — tanlash,
 * Esc — avval qidiruvni tozalaydi, keyin oynani yopadi.
 */
const MarketPickerDialog = ({ open, selected, onClose, onSelect }: MarketPickerDialogProps) => {
  const { t } = useTranslation("orders");
  const listId = useId();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const { useGetMarkets } = useMarkets();
  // Faqat oyna ochiq bo'lganda so'raladi (avval sahifa ochilishi bilan ketardi).
  const { data, isLoading } = useGetMarkets({ search: debounced, status: "active", limit: 20 }, open);

  const markets = useMemo(() => {
    const list = toMarketList(data).filter(isActiveMarket);
    // Tanlangan (faol) market ro'yxat boshida — qidiruv natijasida bo'lmasa ham ko'rinadi.
    if (!selected || !isActiveMarket(selected) || debounced) return list;
    return [selected, ...list.filter((market) => market.id !== selected.id)];
  }, [data, debounced, selected]);

  const optionId = (index: number) => `${listId}-option-${encodeURIComponent(String(markets[index]?.id ?? index))}`;
  const current = activeIndex >= 0 && activeIndex < markets.length ? activeIndex : -1;

  const move = (index: number) => {
    if (markets.length === 0) return;
    const next = (index + markets.length) % markets.length;
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
        move(current < 0 ? markets.length - 1 : current - 1);
        break;
      case "Home":
      case "End":
        if (markets.length === 0) return;
        event.preventDefault();
        move(event.key === "Home" ? 0 : markets.length - 1);
        break;
      case "Enter": {
        // Sahifa formasi yuborilmasin — Enter faqat faol qatorni tanlaydi.
        event.preventDefault();
        const market = markets[current];
        if (market) onSelect(market);
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onExited={reset}
      size="xl"
      icon={Store}
      title={t("selectMarketButton")}
      description={t("marketModalSubtitle")}
    >
      <TextInput
        mode="search"
        value={query}
        onValueChange={(next) => {
          setQuery(next);
          setActiveIndex(-1);
        }}
        placeholder={t("searchMarket")}
        aria-label={t("createMarketSearchAria")}
        role="combobox"
        aria-expanded
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={current >= 0 ? optionId(current) : undefined}
        autoComplete="off"
        onKeyDown={handleKeyDown}
      />
      <div className="flex min-h-0 flex-col border-t border-border pt-2">
        <div
          id={listId}
          role="listbox"
          aria-label={t("createMarketListLabel")}
          aria-busy={isLoading || undefined}
          // Bosilganda fokus qidiruv maydonida qoladi (`aria-activedescendant`).
          onMouseDown={(event) => event.preventDefault()}
          className="-mx-1 flex max-h-[400px] min-h-0 flex-col gap-0.5 overflow-y-auto overscroll-contain"
        >
          {isLoading
            ? Array.from({ length: 6 }, (_, index) => (
                <div key={index} role="presentation" className="flex min-h-14 items-center gap-3 px-3 py-2">
                  <Skeleton shape="circle" width={20} height={20} />
                  <span className="flex flex-1 flex-col gap-1.5">
                    <Skeleton width="40%" />
                    <Skeleton width="28%" />
                  </span>
                </div>
              ))
            : markets.map((market, index) => {
                const isSelected = selected?.id === market.id;
                const phone = getMarketPhone(market);
                return (
                  <div
                    key={market.id}
                    id={optionId(index)}
                    role="option"
                    aria-selected={isSelected}
                    data-active={index === current || undefined}
                    onMouseMove={() => {
                      if (index !== current) setActiveIndex(index);
                    }}
                    onClick={() => onSelect(market)}
                    className={cx(ROW, isSelected ? "bg-action-soft" : index === current ? "bg-sunken" : "hover:bg-sunken")}
                  >
                    <span
                      aria-hidden="true"
                      className={cx(
                        "inline-flex size-5 shrink-0 items-center justify-center rounded-full",
                        isSelected ? "bg-action text-on-solid" : "border-2 border-border-strong",
                      )}
                    >
                      {isSelected ? <Check size={12} strokeWidth={3} /> : null}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate font-semibold text-text">{market.name}</span>
                      {phone ? (
                        <span className="flex items-center gap-1 text-xs text-text-muted">
                          <Phone size={12} aria-hidden="true" className="shrink-0" />
                          {formatPhone(phone)}
                        </span>
                      ) : null}
                    </span>
                  </div>
                );
              })}
          {!isLoading && markets.length === 0 ? (
            <div role="presentation" className="flex flex-col items-center gap-2 px-2.5 py-8 text-center">
              <Store size={22} aria-hidden="true" className="text-text-muted" />
              <span className="text-[13px] font-semibold text-text">{t("marketNotFound")}</span>
            </div>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
};

type MarketTriggerProps = {
  market: MarketOption | null;
  open: boolean;
  onOpen: () => void;
};

/** Maydon ko'rinishidagi tugma (`.el-input.el-select`): ikonka · nom va telefon (yoki taklif) · chevron. */
const MarketTrigger = ({ market, open, onOpen }: MarketTriggerProps) => {
  const { t } = useTranslation("orders");
  const field = useFieldControl();
  const valueId = useId();
  const phone = getMarketPhone(market);

  return (
    <Pressable
      id={field.id}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-labelledby={field.labelId ? `${field.labelId} ${valueId}` : valueId}
      aria-describedby={field["aria-describedby"]}
      aria-invalid={field["aria-invalid"]}
      aria-required={field["aria-required"]}
      onClick={onOpen}
      className={cx(
        "flex min-h-16 w-full min-w-0 items-center gap-3 rounded-[10px] border bg-input px-3 py-2.5 text-left text-sm",
        "transition-[background-color,border-color,box-shadow] duration-150 motion-reduce:transition-none",
        open
          ? "border-action ring-3 ring-focus"
          : field.invalid
            ? "border-danger"
            : "border-border-strong hover:border-text-subtle",
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted"
      >
        <Store size={18} />
      </span>
      <span id={valueId} className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-semibold text-text">{market ? market.name : t("selectMarketButton")}</span>
        {market ? (
          phone ? (
            <span className="flex items-center gap-1.5 text-[13px] text-text-muted">
              <Phone size={14} aria-hidden="true" className="shrink-0" />
              {formatPhone(phone)}
            </span>
          ) : null
        ) : (
          <span className="text-[13px] text-text-muted">{t("searchInstruction")}</span>
        )}
      </span>
      {open ? (
        <ChevronUp size={16} aria-hidden="true" className="shrink-0 text-action-fg" />
      ) : (
        <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-text-subtle" />
      )}
    </Pressable>
  );
};

export type MarketPickerFieldProps = {
  /** Yorliq faqat ekran o'quvchi uchun (AI rejimidagi «Avval marketni tanlang» kartasi — maketda yorliqsiz). */
  hideLabel?: boolean;
  /** Market tanlangach (forma qiymati yangilangandan keyin). */
  onSelectMarket?: (market: MarketOption) => void;
};

/**
 * MARKET MAYDONI — umumiy forma (`FormProvider`) dagi `market` qiymati: yorliq «Market *», tugma-maydon,
 * tanlangach ostida «Boshqa market tanlash uchun ro'yxatni oching» + «Tozalash». Bosilsa — tanlash oynasi.
 * 1-qadam kartasi va AI rejimi (market tanlanmagan) shuni ishlatadi.
 */
export const MarketPickerField = memo(({ hideLabel = false, onSelectMarket }: MarketPickerFieldProps) => {
  const { t } = useTranslation(["orders", "common"]);
  const [open, setOpen] = useState(false);
  const triggerWrapRef = useRef<HTMLDivElement>(null);
  const { control } = useFormContext<OrderCreateFormValues>();
  const {
    field,
    fieldState: { error },
  } = useController({ control, name: "market" });
  const market = field.value;

  const select = (next: MarketOption) => {
    field.onChange(next);
    setOpen(false);
    onSelectMarket?.(next);
  };

  const clear = () => {
    field.onChange(null);
    // Tozalangach fokus maydonga — klaviatura bilan ishlovchi joyini yo'qotmasin.
    triggerWrapRef.current?.querySelector("button")?.focus();
  };

  return (
    <>
      <Field id="market" label={t("createMarketLabel")} required labelAs="span" hideLabel={hideLabel} error={error?.message}>
        <div ref={triggerWrapRef} className="min-w-0">
          <MarketTrigger market={market} open={open} onOpen={() => setOpen(true)} />
        </div>
        {market ? (
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="text-xs text-text-muted">{t("selectAnotherMarket")}</span>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={X}
              aria-label={t("createMarketClearAria")}
              onClick={clear}
              className="-mr-2.5 max-md:-ml-2.5 max-md:mr-0"
            >
              {t("clear", { ns: "common" })}
            </Button>
          </div>
        ) : null}
      </Field>
      {/* `Field` dan TASHQARIDA: oynadagi qidiruv maydoni «Market» yorlig'i/id'sini (kontekst) olib qolmasin. */}
      <MarketPickerDialog open={open} selected={market} onClose={() => setOpen(false)} onSelect={select} />
    </>
  );
});

MarketPickerField.displayName = "MarketPickerField";
