// dizayn-v2: superadmin-products-select-market-dialog, admin-products-market-select-dialog, manager-products-market-select-dialog, registrator-products-market-select-dialog
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { Store } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../../shared/lib/cx";
import { formatPhone } from "../../../../shared/lib/formatPhone";
import { Button, Dialog, ErrorState, Skeleton, TextInput } from "../../../../shared/ui/primitives";
import type { ProductMarket } from "../../model/productView";

/** `.el-option` — tanlash oynasidagi qator (maket: 56 px, radio belgi, nom + telefon). */
const ROW =
  "flex min-h-14 w-full cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-text " +
  "transition-[background-color] duration-150 motion-reduce:transition-none";

const normalize = (value: string) => value.trim().toLocaleLowerCase();
const digitsOf = (value: string) => value.replace(/\D/g, "");

/** Nom yoki telefon bo'yicha (telefonda faqat raqamlar solishtiriladi: «90 315» → «+998903152241»). */
const matches = (market: ProductMarket, query: string) => {
  const text = normalize(query);
  if (!text) return true;
  if (normalize(market.name).includes(text)) return true;
  const digits = digitsOf(text);
  return digits.length > 0 && digitsOf(market.phone).includes(digits);
};

export type SelectMarketDialogProps = {
  open: boolean;
  markets: readonly ProductMarket[];
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry: () => void;
  onClose: () => void;
  /** «Tanlash» — tanlangan market bilan (sahifa `/products/create-product/:id` ga o'tadi). */
  onConfirm: (market: ProductMarket) => void;
};

/**
 * MARKETNI TANLANG — maket `*-products-select-market-dialog` / `*-products-market-select-dialog`: `Dialog` lg
 * (telefonda pastki varaqa), `Store` ikonka, «Faqat faol marketlar ko'rsatiladi»; «Market qidirish...» (nom yoki
 * telefon, ro'yxat ichida — `GET markets?status=active&limit=100` javobi, avvalgidek); `listbox` «Faol marketlar»
 * (radio qatorlar, nom + telefon); «Bekor qilish» / «Tanlash» (market tanlanmaguncha o'chiq).
 *
 * Klaviatura (fokus qidiruvda): ↑ ↓ Home End — tanlovni siljitadi, Enter — «Tanlash», Esc — avval qidiruvni
 * tozalaydi, keyin oynani yopadi.
 */
export const SelectMarketDialog = ({
  open,
  markets,
  isLoading,
  isError,
  error,
  onRetry,
  onClose,
  onConfirm,
}: SelectMarketDialogProps) => {
  const { t } = useTranslation("products");
  const listId = useId();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<ProductMarket["id"] | null>(null);

  const visible = useMemo(() => markets.filter((market) => matches(market, query)), [markets, query]);
  // Faqat ko'rinib turgan tanlov hisoblanadi: qidiruv tanlangan marketni yashirsa, «Tanlash» va Enter uni
  // ko'rinmay turib tasdiqlamaydi.
  const selected = visible.find((market) => market.id === selectedId) ?? null;
  const selectedIndex = visible.findIndex((market) => market.id === selectedId);
  const optionId = (market: ProductMarket) => `${listId}-option-${encodeURIComponent(String(market.id))}`;

  const select = (market: ProductMarket) => {
    setSelectedId(market.id);
    document.getElementById(optionId(market))?.scrollIntoView?.({ block: "nearest" });
  };

  const move = (index: number) => {
    if (visible.length === 0) return;
    select(visible[(index + visible.length) % visible.length]);
  };

  const confirm = () => {
    if (selected) onConfirm(selected);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(selectedIndex < 0 ? 0 : selectedIndex + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(selectedIndex < 0 ? visible.length - 1 : selectedIndex - 1);
        break;
      case "Home":
      case "End":
        if (visible.length === 0) return;
        event.preventDefault();
        move(event.key === "Home" ? 0 : visible.length - 1);
        break;
      case "Enter":
        event.preventDefault();
        confirm();
        break;
      default:
        break;
    }
  };

  const reset = () => {
    setQuery("");
    setSelectedId(null);
  };

  const body = isLoading ? (
    Array.from({ length: 6 }, (_, index) => (
      <div key={index} role="presentation" className="flex min-h-14 items-center gap-3 px-3 py-2">
        <Skeleton shape="circle" width={20} height={20} />
        <span className="flex flex-1 flex-col gap-1.5">
          <Skeleton width="40%" />
          <Skeleton width="28%" />
        </span>
      </div>
    ))
  ) : visible.length === 0 ? (
    <div role="presentation" className="flex flex-col items-center gap-1 px-2.5 py-8 text-center">
      <Store size={22} aria-hidden="true" className="mb-1 text-text-muted" />
      <span className="text-[13px] font-semibold text-text">
        {markets.length === 0 ? t("v2.selectMarket.empty") : t("v2.selectMarket.notFound")}
      </span>
      {markets.length > 0 ? (
        <span className="text-[13px] text-text-muted">{t("v2.selectMarket.notFoundHint", { query: query.trim() })}</span>
      ) : null}
    </div>
  ) : (
    visible.map((market) => {
      const isSelected = market.id === selectedId;
      return (
        <div
          key={market.id}
          id={optionId(market)}
          role="option"
          aria-selected={isSelected}
          onClick={() => setSelectedId(market.id)}
          onDoubleClick={() => onConfirm(market)}
          className={cx(ROW, isSelected ? "bg-action-soft" : "hover:bg-sunken")}
        >
          <span
            aria-hidden="true"
            className={cx(
              "size-5 shrink-0 rounded-full bg-surface",
              isSelected ? "border-[6px] border-action" : "border-2 border-border-strong",
            )}
          />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={cx("truncate font-semibold", isSelected ? "text-action-fg" : "text-text")}>
              {market.name}
            </span>
            {market.phone ? (
              <span className="text-xs font-medium text-text-muted">{formatPhone(market.phone)}</span>
            ) : null}
          </span>
        </div>
      );
    })
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onExited={reset}
      size="lg"
      icon={Store}
      title={t("v2.selectMarket.title")}
      description={t("v2.selectMarket.description")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("v2.selectMarket.cancel")}
          </Button>
          <Button onClick={confirm} disabled={!selected}>
            {t("v2.selectMarket.confirm")}
          </Button>
        </>
      }
    >
      {isError && markets.length === 0 ? (
        <ErrorState error={error} title={t("v2.selectMarket.loadFailed")} onRetry={onRetry} />
      ) : (
        <>
          <TextInput
            mode="search"
            value={query}
            onValueChange={setQuery}
            placeholder={t("v2.selectMarket.searchPlaceholder")}
            aria-label={t("v2.selectMarket.searchAria")}
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={selected ? optionId(selected) : undefined}
            autoComplete="off"
            onKeyDown={handleKeyDown}
          />
          <div
            id={listId}
            role="listbox"
            aria-label={t("v2.selectMarket.listLabel")}
            aria-busy={isLoading || undefined}
            // Bosilganda fokus qidiruv maydonida qoladi (`aria-activedescendant`).
            onMouseDown={(event) => event.preventDefault()}
            className="-mx-3 flex max-h-[372px] min-h-0 flex-col gap-0.5 overflow-y-auto overscroll-contain"
          >
            {body}
          </div>
        </>
      )}
    </Dialog>
  );
};
