// dizayn-v2: shell
import { type FocusEvent, type KeyboardEvent, type Ref } from "react";
import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { IconButton, Spinner } from "../../../shared/ui/primitives";
import type { HeaderSearchState } from "../model/useHeaderSearch";
import { KBD, SEARCH_INPUT } from "./styles";

/**
 * Global qidiruv maydoni (maket `.el-search` + `.el-input`, `role="combobox"`). Desktopda yuqori panelda
 * (`HeaderSearch`), planshet/telefonda qidiruv ekranining tepasida (`SearchScreen`).
 *
 * O'ng chetda bittasi: yozilgan bo'lsa — «Qidiruvni tozalash» (kutilayotgan so'rovda spinner); bo'sh va
 * fokusda (desktop) — `Ctrl K` belgisi (taxta: «Qidiruv · bo'sh fokus»).
 */

type SearchFieldProps = {
  search: HeaderSearchState;
  listId: string;
  inputRef?: Ref<HTMLInputElement>;
  /** Qidiruv ekrani: 48px maydon, 44px tozalash tugmasi. */
  large?: boolean;
  focused?: boolean;
  showShortcut?: boolean;
  onFocus?: () => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  /** Esc maydon bo'sh va ro'yxat yopiq paytda (qidiruv ekranini yopish uchun). */
  onEscape?: () => void;
  /** Natija tanlandi (Enter). */
  onChosen?: () => void;
  className?: string;
};

const SearchField = ({
  search,
  listId,
  inputRef,
  large = false,
  focused = false,
  showShortcut = false,
  onFocus,
  onBlur,
  onEscape,
  onChosen,
  className,
}: SearchFieldProps) => {
  const { t } = useTranslation("ui");
  const expanded = search.view !== "closed";

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const result = search.handleKey(event.key);
    if (!result) return;
    if (result === "escape") {
      if (!onEscape) return;
      onEscape();
    }
    event.preventDefault();
    // Esc ni shu yerda ishlatdik — sahifadagi boshqa Esc tinglovchilari (oyna, menyu) yopilmasin.
    if (event.key === "Escape") event.nativeEvent.stopImmediatePropagation();
    if (result === "chosen") onChosen?.();
  };

  const trailing = search.query ? (
    search.pending ? (
      <span aria-hidden="true" className={cx("absolute inline-flex text-text-subtle", large ? "right-3.5 top-4" : "right-3.5 top-3")}>
        <Spinner size="sm" />
      </span>
    ) : (
      <IconButton
        label={t("header.search.clear")}
        icon={X}
        size={large ? "lg" : "sm"}
        className={cx("absolute text-text-subtle", large ? "right-0.5 top-0.5" : "right-1 top-1")}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          search.clear();
          search.setOpen(true);
        }}
      />
    )
  ) : showShortcut && focused ? (
    <span aria-hidden="true" className={cx(KBD, "pointer-events-none absolute right-2.5 top-[9px]")}>
      Ctrl K
    </span>
  ) : null;

  return (
    <div className={cx("relative flex items-center", className)}>
      <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3 text-text-subtle" />
      <input
        ref={inputRef}
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-label={t("header.search.label")}
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={search.activeId}
        placeholder={t("header.search.placeholder")}
        value={search.query}
        onChange={(event) => search.setQuery(event.target.value)}
        onFocus={() => {
          search.setOpen(true);
          onFocus?.();
        }}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className={cx(SEARCH_INPUT, large && "h-12 rounded-xl")}
      />
      {trailing}
    </div>
  );
};

export default SearchField;
