// dizayn-v2: shell
import { memo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useFocusTrap } from "../../../shared/lib/useFocusTrap";
import { Button } from "../../../shared/ui/primitives";
import type { HeaderSearchState } from "../model/useHeaderSearch";
import SearchField from "./SearchField";
import SearchResults from "./SearchResults";

/**
 * PLANSHET VA TELEFONDAGI GLOBAL QIDIRUV EKRANI (< 1024) — maket `courier-dashboard-mobile-search`,
 * taxta `tizim-states-navigation` → «Qidiruv rejimi»: yuqori panel o'rnida maydon (fokusda) va «Yopish»,
 * ostida natijalar; orqa fon `overlay`, pastki menyu ham yopiladi.
 *
 * `body` ga portal: ilova (`#root`) `inert`, fokus ekran ichida aylanadi, Esc — avval ro'yxatni, keyin
 * ekranni yopadi; yopilganda fokus qidiruv tugmasiga qaytadi.
 */

type SearchScreenProps = {
  open: boolean;
  search: HeaderSearchState;
  listId: string;
  onClose: () => void;
};

const SearchScreen = ({ open, search, listId, onClose }: SearchScreenProps) => {
  const { t } = useTranslation("ui");
  // Maydondagi Esc avval ro'yxatni yopadi (SearchField hodisani shu yerda to'xtatadi), keyin — ekranni.
  const panelRef = useFocusTrap<HTMLDivElement>(open, { inertAppRoot: true, onEscape: onClose });

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9990] flex flex-col bg-overlay">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("header.search.label")}
        tabIndex={-1}
        className="flex min-h-0 flex-col gap-2 outline-none"
      >
        <div className="flex h-16 shrink-0 items-center gap-1 border-b border-border bg-surface pl-3 pr-1">
          <SearchField
            search={search}
            listId={listId}
            large
            className="min-w-0 flex-1"
            onEscape={onClose}
            onChosen={onClose}
          />
          <Button variant="ghost" className="shrink-0 px-2.5" onClick={onClose}>
            {t("header.search.close")}
          </Button>
        </div>
        <SearchResults search={search} listId={listId} variant="screen" onChosen={onClose} className="mx-2" />
      </div>
      {/* Bo'sh joyga bosish — yopish (sichqoncha/barmoq uchun; klaviaturada «Yopish» va Esc bor). */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="min-h-0 flex-1 cursor-default"
      />
    </div>,
    document.body,
  );
};

export default memo(SearchScreen);
