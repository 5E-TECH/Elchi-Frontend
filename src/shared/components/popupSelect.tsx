import { memo, useId, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../lib/cx";
import { Button } from "../ui/primitives/Button";
import { Dialog } from "../ui/primitives/Dialog";
import { TextInput } from "../ui/primitives/TextInput";
import {
  findEnabledIndex,
  firstEnabledIndex,
  lastEnabledIndex,
  matchesQuery,
  pageIndex,
} from "../ui/primitives/select/selectModel";

/**
 * TANLASH OYNASI — eski API, ichi dizayn v2 `Dialog` (lg, 560 px; telefonda pastki varaqa) + qidiruv +
 * ro'yxat (maketlar `superadmin-payments-to-give-dialog`, `admin-products-market-select-dialog`,
 * `manager-dispatch-courier-dialog`).
 *
 * Tuzilma: sarlavha (ikonka · sarlavha + izoh · «Yopish») → «Qidirish...» maydoni → ro'yxat (qator 56 px,
 * chapda radio belgisi, tanlangan — ko'k fon) → «Bekor qilish» · «Tanlash» (tanlanmaguncha o'chiq).
 * `immediateSelection` — qatorni bosish darhol tanlaydi va yopadi (pastki tugmalar yo'q).
 *
 * Klaviatura: fokus qidiruv maydonida (`role="combobox"`, `aria-activedescendant`), ↑ ↓ Home End
 * PageUp PageDown — ro'yxatda yurish, Enter — belgilash (belgilangan qatorda yana Enter — «Tanlash»),
 * Esc — avval qidiruvni tozalaydi, keyin oynani yopadi.
 *
 * ⚠️ `renderItem(item, isSelected)` ning ikkinchi argumenti v2 da doim `false`: tanlov radio belgisi va
 * qator foni bilan ko'rsatiladi. Eski sahifalar `isSelected` da oq matn berardi (to'q fon uchun) — v2
 * ning och `action-soft` fonida u o'qilmay qolardi.
 */
interface PopupSelectProps<T> {
  isOpen: boolean;
  onClose: () => void;
  data?: T[];
  onSelect: (item: T) => void;
  keyExtractor: (item: T) => string | number;
  renderItem?: (item: T, isSelected: boolean) => ReactNode;
  searchKeys: (keyof T)[];
  title: string;
  description?: string;
  icon?: ReactNode;
  placeholder?: string;
  selectLabel?: string;
  cancelLabel?: string;
  /** Oyna paneli klassi. */
  className?: string;
  labelKey?: keyof T; // For default item title
  secondaryLabelKey?: keyof T; // For default item subtitle
  immediateSelection?: boolean;
}

/** `.el-option` — tanlash oynasidagi qator (maket: `min-height: 56px; padding: 8px 12px; gap: 12px`). */
const ROW =
  "flex min-h-14 w-full cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2 text-left text-sm " +
  "text-text transition-[background-color] duration-150 motion-reduce:transition-none";

const PopupSelect = <T extends object>({
  isOpen,
  onClose,
  data,
  onSelect,
  keyExtractor,
  renderItem,
  searchKeys,
  title,
  description = "",
  icon,
  placeholder,
  selectLabel,
  cancelLabel,
  className,
  labelKey,
  secondaryLabelKey,
  immediateSelection = false,
}: PopupSelectProps<T>) => {
  const { t } = useTranslation("ui");
  const listId = useId();
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | number | null>(null);
  const [activeKey, setActiveKey] = useState<string | number | null>(null);

  const filtered = useMemo(() => {
    const items = data ?? [];
    if (!query.trim()) return items;
    return items.filter((item) => searchKeys.some((key) => matchesQuery(String(item[key] ?? ""), query)));
  }, [data, query, searchKeys]);

  const keys = useMemo(() => filtered.map((item) => keyExtractor(item)), [filtered, keyExtractor]);
  /** Klaviatura yurishi uchun (qatorlar o'chirilmaydi). */
  const rows = useMemo(() => keys.map(() => ({})), [keys]);
  const activeFound = activeKey === null ? -1 : keys.indexOf(activeKey);
  const activeIndex = activeFound >= 0 ? activeFound : query.trim() ? firstEnabledIndex(rows) : -1;
  const selectedItem = useMemo(
    () => (selectedKey === null ? null : ((data ?? []).find((item) => keyExtractor(item) === selectedKey) ?? null)),
    [data, keyExtractor, selectedKey],
  );

  /**
   * Qator id'si KALITDAN (indeksdan emas): qidiruvda ro'yxat o'zgarsa `aria-activedescendant` ham o'zgaradi —
   * ekran o'quvchi yangi faol qatorni aytadi (indeks bo'yicha `-option-0` bir xil qolardi).
   */
  const optionId = (index: number) => `${listId}-option-${encodeURIComponent(String(keys[index]))}`;
  const searchLabel = placeholder ?? t("popupSelect.search");

  const reset = () => {
    setQuery("");
    setSelectedKey(null);
    setActiveKey(null);
  };

  const confirm = () => {
    if (!selectedItem) return;
    onSelect(selectedItem);
    onClose();
  };

  const choose = (item: T | undefined) => {
    if (!item) return;
    if (immediateSelection) {
      onSelect(item);
      onClose();
      return;
    }
    const key = keyExtractor(item);
    setSelectedKey(key);
    setActiveKey(key);
  };

  const move = (index: number) => {
    if (index < 0) return;
    const key = keys[index];
    setActiveKey(key);
    document.getElementById(optionId(index))?.scrollIntoView?.({ block: "nearest" });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(activeIndex < 0 ? firstEnabledIndex(rows) : findEnabledIndex(rows, activeIndex + 1, 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        move(activeIndex < 0 ? lastEnabledIndex(rows) : findEnabledIndex(rows, activeIndex - 1, -1));
        break;
      case "PageDown":
      case "PageUp":
        event.preventDefault();
        move(pageIndex(rows, activeIndex, event.key === "PageDown" ? 1 : -1));
        break;
      case "Enter": {
        event.preventDefault();
        const item = filtered[activeIndex];
        if (!item) return;
        if (!immediateSelection && keyExtractor(item) === selectedKey) confirm();
        else choose(item);
        break;
      }
      default:
        break;
    }
  };

  const renderDefault = (item: T) => {
    const label = labelKey ? String(item[labelKey] ?? "").trim() : String(item);
    const initial = label.charAt(0).toLocaleUpperCase() || "•";
    return (
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-[13px] font-bold text-text-muted max-md:hidden"
        >
          {initial}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-semibold text-text">{label}</span>
          {secondaryLabelKey ? (
            <span className="truncate text-xs text-text-muted">{String(item[secondaryLabelKey] ?? "")}</span>
          ) : null}
        </span>
      </span>
    );
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      onExited={reset}
      title={title}
      description={description || undefined}
      icon={icon ?? undefined}
      size="lg"
      className={className}
      footerDivider
      footer={
        immediateSelection ? undefined : (
          <>
            <Button variant="secondary" onClick={onClose}>
              {cancelLabel ?? t("popupSelect.cancel")}
            </Button>
            <Button onClick={confirm} disabled={!selectedItem}>
              {selectLabel ?? t("popupSelect.confirm")}
            </Button>
          </>
        )
      }
    >
      <TextInput
        mode="search"
        value={query}
        onValueChange={(next) => {
          setQuery(next);
          setActiveKey(null);
        }}
        placeholder={searchLabel}
        aria-label={searchLabel}
        role="combobox"
        aria-expanded={true}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
        autoComplete="off"
        onKeyDown={handleKeyDown}
      />
      {/*
        Maket: ro'yxat qidiruv va amallardan chiziq bilan ajralgan (`border-top` / `border-bottom`). Pastki
        chiziq — `Dialog footerDivider`; yuqorisi — shu o'ram (ikkalasi bir xil enda). Maketda chiziqlar
        oyna chetidan chetga, lekin `Dialog` tanasi aylanuvchi (`overflow-y-auto`) — undan chiqib bo'lmaydi.
      */}
      <div className="flex min-h-0 flex-col border-t border-border pt-2">
        <div
          id={listId}
          role="listbox"
          aria-label={title}
          // Bosilganda fokus qidiruv maydonida qoladi (`aria-activedescendant`).
          onMouseDown={(event) => event.preventDefault()}
          className="-mx-1 flex max-h-[360px] min-h-0 flex-col gap-0.5 overflow-y-auto overscroll-contain"
        >
          {filtered.map((item, index) => {
            const key = keyExtractor(item);
            const selected = !immediateSelection && key === selectedKey;
            const active = index === activeIndex;
            return (
              <div
                key={key}
                id={optionId(index)}
                role="option"
                aria-selected={selected}
                data-active={active || undefined}
                onMouseMove={() => {
                  if (!active) setActiveKey(key);
                }}
                onClick={() => choose(item)}
                className={cx(ROW, selected ? "bg-action-soft" : active ? "bg-sunken" : null)}
              >
                {immediateSelection ? null : (
                  <span
                    aria-hidden="true"
                    className={cx(
                      "inline-flex size-5 shrink-0 items-center justify-center rounded-full",
                      selected ? "bg-action text-on-solid" : "border-2 border-border-strong",
                    )}
                  >
                    {selected ? <Check size={12} strokeWidth={3} /> : null}
                  </span>
                )}
                <span className="flex min-w-0 flex-1 items-center">{renderItem ? renderItem(item, false) : renderDefault(item)}</span>
              </div>
            );
          })}
          {filtered.length === 0 ? (
            <div role="presentation" className="px-2.5 py-6 text-center text-[13px] text-text-muted">
              {query.trim() ? (
                <span className="flex flex-col gap-0.5">
                  <span className="font-semibold text-text">{t("select.empty")}</span>
                  <span>{t("select.emptyHint", { query: query.trim() })}</span>
                </span>
              ) : (
                t("select.noOptions")
              )}
            </div>
          ) : null}
        </div>
      </div>
      <span role="status" className="sr-only">
        {query.trim() ? (filtered.length ? t("select.results", { count: filtered.length }) : t("select.empty")) : ""}
      </span>
    </Dialog>
  );
};

export default memo(PopupSelect) as typeof PopupSelect;
