// dizayn-v2: common-inbox, superadmin-notifications-inbox
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Ellipsis, type LucideIcon } from "lucide-react";
import { cx } from "../../../shared/lib/cx";
import { IconButton, Portal, useDismiss, usePopover } from "../../../shared/ui/primitives";

export type ItemMenuAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
  onSelect: () => void;
};

/** `.el-menu-item` (CODE-MAP): 36 px, telefonda 44 px; xavfli band — `danger-fg`. */
const ITEM =
  "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm outline-none transition-[background-color] " +
  "duration-150 motion-reduce:transition-none max-md:h-11 [&>svg]:shrink-0";

/**
 * Qator «…» menyusi (maket `common-inbox`: `aria-haspopup="menu"`, «Bildirishnoma amallari»).
 * WAI-ARIA menu button: ochilganda fokus birinchi bandda, ↑ ↓ Home End, Esc — yopadi va tugmaga qaytaradi,
 * Tab — yopadi. Menyu `Portal` da (`dropdown` qatlami), tugma ostida o'ngga tekislangan.
 */
export const NotificationItemMenu = ({
  label,
  actions,
}: {
  label: string;
  actions: ItemMenuAction[];
}) => {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const itemsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const { anchorRef, floatingRef, floatingStyles, side, isPositioned } = usePopover<
    HTMLButtonElement,
    HTMLDivElement
  >({
    open,
    placement: "bottom-end",
    offset: 4,
  });

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) anchorRef.current?.focus({ preventScroll: true });
  };

  useDismiss({ open, refs: [anchorRef, floatingRef], onDismiss: () => close(false) });

  useLayoutEffect(() => {
    if (!open || !isPositioned) return;
    itemsRef.current.find(Boolean)?.focus({ preventScroll: true });
  }, [open, isPositioned]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = itemsRef.current.filter((item): item is HTMLButtonElement => Boolean(item));
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (index: number) => items[(index + items.length) % items.length]?.focus();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusAt(current + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusAt(current === -1 ? items.length - 1 : current - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusAt(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusAt(items.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") {
      close(true);
    }
  };

  return (
    <>
      <IconButton
        ref={anchorRef}
        size="sm"
        icon={Ellipsis}
        label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close(false) : setOpen(true))}
      />
      {open ? (
        <Portal layer="dropdown" anchor={anchorRef}>
          <div
            ref={floatingRef}
            id={menuId}
            role="menu"
            aria-label={label}
            style={floatingStyles}
            data-side={side}
            onKeyDown={onMenuKeyDown}
            className={cx(
              "flex w-[min(260px,calc(100vw-32px))] flex-col gap-0.5 rounded-xl border border-border bg-raised p-1.5 shadow-xl",
              "transition-[opacity,translate] duration-200 ease-out starting:opacity-0 motion-reduce:transition-none",
              side === "top" ? "starting:translate-y-1" : "starting:-translate-y-1",
            )}
          >
            {actions.map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  ref={(element) => {
                    itemsRef.current[index] = element;
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => {
                    close(true);
                    action.onSelect();
                  }}
                  className={cx(
                    ITEM,
                    action.danger
                      ? "text-danger-fg hover:bg-danger-soft focus-visible:bg-danger-soft"
                      : "text-text hover:bg-sunken focus-visible:bg-sunken [&>svg]:text-text-muted",
                  )}
                >
                  <Icon size={16} aria-hidden="true" />
                  {action.label}
                </button>
              );
            })}
          </div>
        </Portal>
      ) : null}
    </>
  );
};
