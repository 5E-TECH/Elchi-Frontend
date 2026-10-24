// dizayn-v2: superadmin-warehouse-detail, admin-warehouse-detail
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { CirclePause, CirclePlay, ClipboardList, Ellipsis, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { IconButton, Portal, Pressable, useDismiss, usePopover } from "../../../../shared/ui/primitives";
import { MENU, MENU_ITEM, MENU_SEPARATOR } from "../../model/classes";

type MenuItem = { key: string; label: string; hint: string; icon: LucideIcon; onSelect: () => void };

export type WarehouseActionsMenuProps = {
  paused: boolean;
  onInventory: () => void;
  onTogglePause: () => void;
};

/**
 * «OMBOR AMALLARI» ⋯ (maket `superadmin-warehouse-detail`: «Inventarizatsiya — Haqiqiy sonni kiritib, farqni
 * tuzatish», chiziq, «Omborni to'xtatish — Yangi buyurtma tushmaydi, qoldiq saqlanadi…»; to'xtatilgan omborda —
 * «Qayta yoqish»). WAI-ARIA menu: ↓/↑ (aylanma), Home/End, Esc (fokus tugmaga), Tab va tashqariga bosish yopadi.
 */
export const WarehouseActionsMenu = ({ paused, onInventory, onTogglePause }: WarehouseActionsMenuProps) => {
  const { t } = useTranslation("warehouses");
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const { anchorRef, floatingRef, floatingStyles } = usePopover<HTMLButtonElement, HTMLDivElement>({
    open,
    placement: "bottom-end",
    offset: 8,
  });

  const items: MenuItem[] = [
    {
      key: "inventory",
      label: t("detail.menu.inventory"),
      hint: t("detail.menu.inventoryHint"),
      icon: ClipboardList,
      onSelect: onInventory,
    },
    paused
      ? {
          key: "resume",
          label: t("detail.menu.resume"),
          hint: t("detail.menu.resumeHint"),
          icon: CirclePlay,
          onSelect: onTogglePause,
        }
      : {
          key: "pause",
          label: t("detail.menu.pause"),
          hint: t("detail.menu.pauseHint"),
          icon: CirclePause,
          onSelect: onTogglePause,
        },
  ];

  const close = (focusTrigger: boolean) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  };

  useDismiss({ open, refs: [anchorRef, floatingRef], onDismiss: (reason) => close(reason === "escape") });

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      floatingRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [floatingRef, open]);

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const nodes = Array.from(floatingRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
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

  const label = t("detail.menu.label");

  return (
    <>
      <IconButton
        ref={(node) => {
          triggerRef.current = node;
          anchorRef.current = node;
        }}
        label={label}
        icon={Ellipsis}
        variant="secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        // Telefonda sarlavha amallari teng bo'linadi — ⋯ esa maketdagidek kvadrat qoladi.
        className="max-md:flex-none!"
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((previous) => !previous)}
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
            aria-label={t("detail.menu.title")}
            style={floatingStyles}
            className={`${MENU} w-[300px] max-w-[calc(100vw-32px)]`}
            onKeyDown={handleMenuKeyDown}
          >
            {items.map((item, index) => (
              <div key={item.key} className="contents">
                {index > 0 ? <div role="separator" className={MENU_SEPARATOR} /> : null}
                <Pressable
                  role="menuitem"
                  tabIndex={-1}
                  className={MENU_ITEM}
                  onClick={() => {
                    close(true);
                    item.onSelect();
                  }}
                >
                  <item.icon size={18} strokeWidth={2} aria-hidden="true" />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-semibold text-text">{item.label}</span>
                    <span className="text-xs text-text-muted">{item.hint}</span>
                  </span>
                </Pressable>
              </div>
            ))}
          </div>
        </Portal>
      ) : null}
    </>
  );
};
