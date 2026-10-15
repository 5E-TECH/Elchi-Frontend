// dizayn-v2: shell
import { memo, useRef, useState, type Ref } from "react";
import { cx } from "../../../shared/lib/cx";
import { useDismiss } from "../model/useDismiss";
import type { HeaderSearchState } from "../model/useHeaderSearch";
import SearchField from "./SearchField";
import SearchResults from "./SearchResults";

/**
 * Desktopdagi global qidiruv (≥ 1024): yuqori panelda `min(420px, 100%)` kenglikdagi maydon, natijalar ostida
 * (maket `.el-topbar .el-search`, taxta `tizim-states-navigation` → «Ish holatida · 1440 px»).
 * Tashqariga bosish yoki Esc ro'yxatni yopadi; matn saqlanadi.
 */

type HeaderSearchProps = {
  search: HeaderSearchState;
  listId: string;
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
};

const HeaderSearch = ({ search, listId, inputRef, className }: HeaderSearchProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  // Esc maydonning o'zida ushlanadi (SearchField); bu yerda — faqat tashqariga bosish.
  useDismiss(search.open, [rootRef], search.close, { escape: false });

  return (
    <div ref={rootRef} className={cx("relative w-[min(420px,100%)] min-w-0 shrink", className)}>
      <SearchField
        search={search}
        listId={listId}
        inputRef={inputRef}
        focused={focused}
        showShortcut
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          setFocused(false);
          // Tab bilan boshqa joyga o'tilsa ro'yxat yopiladi (variantga bosish fokusni olib ketmaydi).
          const next = event.relatedTarget;
          if (next instanceof Node && !rootRef.current?.contains(next)) search.close();
        }}
      />
      <SearchResults
        search={search}
        listId={listId}
        variant="popover"
        className="absolute inset-x-0 top-[calc(100%+8px)] z-10"
      />
    </div>
  );
};

export default memo(HeaderSearch);
