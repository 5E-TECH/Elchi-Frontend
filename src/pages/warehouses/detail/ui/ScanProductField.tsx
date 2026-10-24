// dizayn-v2: superadmin-warehouse-stock-in-dialog, admin-warehouse-stock-in-dialog
import { useId, useState, type KeyboardEvent } from "react";
import { Camera, ScanLine, Store } from "lucide-react";
import { isScanCode } from "../../../../entities/warehouse";
import { cx } from "../../../../shared/lib/cx";
import {
  Button,
  Field,
  Portal,
  Pressable,
  Spinner,
  StatusBadge,
  TextInput,
  useDismiss,
  usePopover,
} from "../../../../shared/ui/primitives";
import { useIsPhone } from "../../../../shared/ui/primitives/date/useIsPhone";
import { useWarehouseText } from "../../model/useWarehouseText";
import { useProductSuggestions, type ProductSuggestion } from "../model/useProductSuggestions";

const OPTION =
  "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm text-text outline-none! " +
  "transition-[background-color] duration-150 motion-reduce:transition-none hover:bg-sunken data-[active=true]:bg-sunken";

export type ScanProductFieldProps = {
  marketId: string | null;
  /** Kod skanerlandi yoki yozilib Enter bosildi. */
  onCode: (code: string) => void;
  /** Nom bo'yicha topilgan mahsulot tanlandi. */
  onPick: (product: ProductSuggestion) => void;
  onCamera: () => void;
  /** So'rov ketmoqda (oxirgi kod). */
  pending: boolean;
  disabled?: boolean;
  /** Yorliq (sukut «Mahsulot»). */
  label?: string;
};

/**
 * «MAHSULOT *» MAYDONI (maket `superadmin-warehouse-stock-in-dialog`): skaner ikonkali katta maydon «Shtrix kod yoki
 * QR'ni skanerlang yoki mahsulot nomini yozing» (telefonda «Kod yoki mahsulot nomi») + «Kamera» (telefonda to'liq
 * enli «Kamera bilan skanerlash»), ostida «USB skaner tayyor» va yo'riqnoma.
 *
 * Combobox: kod (`ELC-P-…`, 8/12/13/14 xonali shtrix kod) yozilib Enter — `onCode`; matn (2+ belgi) — mahsulotlar
 * ro'yxati (↑ ↓, Enter tanlaydi, Esc yopadi), tanlansa `onPick`. Maydon tanlangandan / skandan keyin tozalanadi va
 * fokusda qoladi — keyingi skan shu yerga tushadi.
 */
export const ScanProductField = ({
  marketId,
  onCode,
  onPick,
  onCamera,
  pending,
  disabled,
  label,
}: ScanProductFieldProps) => {
  const { t } = useWarehouseText();
  const isPhone = useIsPhone();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const hintId = useId();
  const looksLikeCode = isScanCode(value);
  const suggestions = useProductSuggestions(value, marketId, !looksLikeCode && !disabled);
  const items = suggestions.items;
  const showList = open && !looksLikeCode && value.trim().length >= 2;
  const { anchorRef, floatingRef, floatingStyles } = usePopover<HTMLDivElement, HTMLDivElement>({
    open: showList,
    placement: "bottom-start",
    offset: 6,
    matchWidth: true,
    maxHeight: 320,
  });
  useDismiss({ open: showList, refs: [anchorRef, floatingRef], onDismiss: () => setOpen(false) });

  // Ro'yxat yangilansa — tanlov birinchi variantga (chizish paytida, effektsiz).
  const [itemsShown, setItemsShown] = useState(items);
  if (itemsShown !== items) {
    setItemsShown(items);
    setActive(0);
  }

  const clear = () => {
    setValue("");
    setOpen(false);
  };

  const pick = (product: ProductSuggestion) => {
    clear();
    onPick(product);
  };

  const submitCode = () => {
    const code = value.trim();
    if (!code) return;
    clear();
    onCode(code);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && showList && items.length) {
      event.preventDefault();
      setActive((index) => (index + 1) % items.length);
      return;
    }
    if (event.key === "ArrowUp" && showList && items.length) {
      event.preventDefault();
      setActive((index) => (index - 1 + items.length) % items.length);
      return;
    }
    if (event.key === "Escape" && showList) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      // Kod (skaner Enter bilan tugatadi) — doim kod; matn — ro'yxatdagi tanlangan mahsulot, bo'lmasa kod sifatida
      // (zavod QR matni ham `lookup` da qidiriladi).
      if (!looksLikeCode && showList && items[active]) pick(items[active]);
      else submitCode();
    }
  };

  const activeId = showList && items[active] ? `${listId}-${items[active].id}` : undefined;

  return (
    <Field label={label ?? t("stockIn.product")} required>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 gap-2">
          <div ref={anchorRef} className="min-w-0 flex-1">
            <TextInput
              size="lg"
              value={value}
              onValueChange={(next) => {
                setValue(next);
                setOpen(true);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setOpen(true)}
              icon={ScanLine}
              placeholder={t(isPhone ? "stockIn.productPlaceholderShort" : "stockIn.productPlaceholder")}
              aria-describedby={hintId}
              autoComplete="off"
              spellCheck={false}
              role="combobox"
              aria-expanded={showList}
              aria-controls={showList ? listId : undefined}
              aria-autocomplete="list"
              aria-activedescendant={activeId}
              disabled={disabled}
              suffix={pending ? <Spinner size="sm" label={t("stockIn.looking")} /> : undefined}
            />
          </div>
          <Button
            variant="secondary"
            size="lg"
            leftIcon={Camera}
            aria-haspopup="dialog"
            onClick={onCamera}
            disabled={disabled}
            className="max-md:hidden"
          >
            {t("stockIn.camera")}
          </Button>
        </div>
        <Button
          variant="secondary"
          size="lg"
          leftIcon={Camera}
          aria-haspopup="dialog"
          onClick={onCamera}
          disabled={disabled}
          fullWidth
          className="md:hidden"
        >
          {t("stockIn.cameraMobile")}
        </Button>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <StatusBadge tone="success" label={t("stockIn.usbReady")} role="status" className="max-md:hidden" />
          <span id={hintId} className="text-xs text-text-muted">
            {t("stockIn.scanHint")}
          </span>
        </div>
      </div>
      {showList ? (
        <Portal layer="dropdown" anchor={anchorRef}>
          <div
            ref={floatingRef}
            id={listId}
            role="listbox"
            aria-label={t("stockIn.suggestionsLabel")}
            style={floatingStyles}
            className="flex flex-col gap-0.5 overflow-y-auto rounded-xl border border-border bg-raised p-1.5 shadow-xl"
          >
            {items.length === 0 ? (
              <p className="m-0 px-2.5 py-2 text-[13px] text-text-muted" role="presentation">
                {suggestions.isFetching || !suggestions.settled ? t("stockIn.searching") : t("stockIn.noSuggestions")}
              </p>
            ) : (
              items.map((product, index) => (
                <Pressable
                  key={product.id}
                  id={`${listId}-${product.id}`}
                  role="option"
                  aria-selected={index === active}
                  data-active={index === active}
                  tabIndex={-1}
                  className={cx(OPTION)}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(product)}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">{product.name}</span>
                    <span className="flex min-w-0 items-center gap-1.5 truncate text-xs text-text-muted">
                      {product.marketName ? (
                        <>
                          <Store size={14} aria-hidden="true" className="shrink-0" />
                          {product.marketName}
                        </>
                      ) : null}
                      {product.barcode ?? product.skuCode ? (
                        <span className="font-mono">{product.barcode ?? product.skuCode}</span>
                      ) : null}
                    </span>
                  </span>
                </Pressable>
              ))
            )}
          </div>
        </Portal>
      ) : null}
    </Field>
  );
};
