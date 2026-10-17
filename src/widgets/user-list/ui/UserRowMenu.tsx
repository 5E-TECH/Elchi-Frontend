// dizayn-v2: superadmin-users-list, admin-users-list
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Ellipsis, type LucideIcon } from "lucide-react";
import { cx } from "../../../shared/lib/cx";
import { IconButton, Portal, useDismiss, usePopover } from "../../../shared/ui/primitives";

export interface UserRowMenuItem {
  key: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  /** `.el-menu-item-danger` — chiziq bilan ajratiladi («O'chirish»). */
  danger?: boolean;
  disabled?: boolean;
}

/** `.el-menu` (CODE-MAP 2.2): `RAISED` + `p-1.5`; band 36 px (telefonda 44), xavfli band — qizil. */
const MENU = "flex min-w-[200px] flex-col gap-0.5 rounded-xl border border-border bg-raised p-1.5 shadow-xl";
const ITEM_BASE =
  "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm outline-none! " +
  "transition-[background-color,color] duration-150 motion-reduce:transition-none max-md:h-11 " +
  "disabled:cursor-not-allowed disabled:opacity-45 [&>svg]:shrink-0";
const ITEM = `${ITEM_BASE} text-text hover:bg-sunken focus-visible:bg-sunken [&>svg]:text-text-muted`;
const ITEM_DANGER = `${ITEM_BASE} text-danger-fg hover:bg-danger-soft focus-visible:bg-danger-soft [&>svg]:text-danger-fg`;
const SEP = "mx-1.5 my-1 h-px shrink-0 bg-border";

/**
 * QATOR AMALLARI MENYUSI (maket `superadmin-users-list`: kebab «… amallari» → «Tahrirlash», «Nofaol qilish» /
 * «Faol qilish», chiziq, «O'chirish»). WAI-ARIA menu: ↓/↑ (aylanma), Home/End, Esc va Tab — yopadi (Esc fokusni
 * tugmaga qaytaradi), tashqariga bosish yopadi. Bandni tanlash menyuni yopib, amalni chaqiradi.
 */
export const UserRowMenu = ({ label, items }: { label: string; items: readonly UserRowMenuItem[] }) => {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const { anchorRef, floatingRef, floatingStyles } = usePopover<HTMLButtonElement, HTMLDivElement>({
    open,
    placement: "bottom-end",
    offset: 4,
  });

  const close = (focusTrigger: boolean) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  };

  useDismiss({
    open,
    refs: [anchorRef, floatingRef],
    onDismiss: (reason) => close(reason === "escape"),
  });

  // Ochilganda — birinchi faol bandga fokus.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      floatingRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [floatingRef, open]);

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const nodes = Array.from(
      floatingRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    );
    if (nodes.length === 0) return;
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    let next: HTMLElement | undefined;
    if (event.key === "ArrowDown") next = nodes[(index + 1) % nodes.length];
    else if (event.key === "ArrowUp") next = nodes[(index - 1 + nodes.length) % nodes.length];
    else if (event.key === "Home") next = nodes[0];
    else if (event.key === "End") next = nodes[nodes.length - 1];
    else if (event.key === "Tab") {
      close(false);
      return;
    }
    if (next) {
      event.preventDefault();
      next.focus();
    }
  };

  return (
    <>
      <IconButton
        ref={(node) => {
          triggerRef.current = node;
          anchorRef.current = node;
        }}
        label={label}
        icon={Ellipsis}
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((previous) => !previous);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      />
      {open ? (
        <Portal layer="dropdown" anchor={anchorRef}>
          <div
            ref={floatingRef}
            id={menuId}
            role="menu"
            aria-label={label}
            style={floatingStyles}
            className={MENU}
            onKeyDown={handleMenuKeyDown}
            onClick={(event) => event.stopPropagation()}
          >
            {items.map((item, index) => (
              <div key={item.key} className="contents">
                {item.danger && index > 0 ? <div role="separator" className={SEP} /> : null}
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  disabled={item.disabled}
                  className={cx(item.danger ? ITEM_DANGER : ITEM)}
                  onClick={() => {
                    // Fokus avval kebab tugmasiga qaytadi: ochiladigan oyna (tasdiq / tahrir) yopilganda fokusni
                    // shu tugmaga qaytaradi (aks holda menyu bandi o'chib, fokus `body` ga tushardi).
                    close(true);
                    item.onSelect();
                  }}
                >
                  <item.icon size={18} strokeWidth={2} aria-hidden="true" />
                  {item.label}
                </button>
              </div>
            ))}
          </div>
        </Portal>
      ) : null}
    </>
  );
};
