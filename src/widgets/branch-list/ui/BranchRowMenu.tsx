// dizayn-v2: superadmin-branches-list-tree, superadmin-branches-list-table
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, Ellipsis, Pencil, Trash2, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import {
  IconButton,
  Portal,
  Pressable,
  useDismiss,
  usePopover,
} from "../../../shared/ui/primitives";

type MenuItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
};

/** `.el-menu` (CODE-MAP 2.2): band 36 px (telefonda 44), xavfli band — qizil, oldidan chiziq. */
const MENU = "flex min-w-[184px] flex-col gap-0.5 rounded-xl border border-border bg-raised p-1.5 shadow-xl";
const ITEM_BASE =
  "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm outline-none! " +
  "transition-[background-color,color] duration-150 motion-reduce:transition-none max-md:h-11 [&>svg]:shrink-0";
const ITEM = `${ITEM_BASE} text-text hover:bg-sunken focus-visible:bg-sunken [&>svg]:text-text-muted`;
const ITEM_DANGER = `${ITEM_BASE} text-danger-fg hover:bg-danger-soft focus-visible:bg-danger-soft [&>svg]:text-danger-fg`;
const SEP = "mx-1.5 my-1 h-px shrink-0 bg-border";

export type BranchRowMenuProps = {
  /** Filial nomi — tugma va menyu nomi «{nom} amallari». */
  name: string;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

/**
 * FILIAL QATORI AMALLARI (maket `superadmin-branches-list-tree`: kebab «{nom} amallari» → «Batafsil»,
 * «Tahrirlash», chiziq, «O'chirish»). WAI-ARIA menu: ↓/↑ (aylanma), Home/End, Esc (fokus tugmaga qaytadi)
 * va Tab yopadi, tashqariga bosish yopadi. Band tanlansa menyu yopiladi (fokus tugmaga) va amal chaqiriladi.
 */
export const BranchRowMenu = ({ name, onOpen, onEdit, onDelete }: BranchRowMenuProps) => {
  const { t } = useTranslation("branches");
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const { anchorRef, floatingRef, floatingStyles } = usePopover<HTMLButtonElement, HTMLDivElement>({
    open,
    placement: "bottom-end",
    offset: 4,
  });
  const label = t("v2.list.rowActions", { name });

  const items: MenuItem[] = [
    { key: "open", label: t("actions.details"), icon: ArrowRight, onSelect: onOpen },
    { key: "edit", label: t("actions.edit"), icon: Pencil, onSelect: onEdit },
    { key: "delete", label: t("actions.delete"), icon: Trash2, onSelect: onDelete, danger: true },
  ];

  const close = (focusTrigger: boolean) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  };

  useDismiss({
    open,
    refs: [anchorRef, floatingRef],
    onDismiss: (reason) => close(reason === "escape"),
  });

  // Ochilganda — birinchi bandga fokus.
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
                <Pressable
                  role="menuitem"
                  tabIndex={-1}
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
                </Pressable>
              </div>
            ))}
          </div>
        </Portal>
      ) : null}
    </>
  );
};
