// dizayn-v2: superadmin-notifications-row-menu, superadmin-notifications-row-menu-inactive
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Ellipsis, type LucideIcon } from "lucide-react";
import { cx } from "../../../shared/lib/cx";
import {
  Dialog,
  IconButton,
  Portal,
  Pressable,
  useDismiss,
  usePopover,
} from "../../../shared/ui/primitives";
import { useIsPhoneViewport } from "../lib/useIsPhoneViewport";

export interface NotificationRowMenuItem {
  key: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  /** `.el-menu-item-danger` — chiziq bilan ajratiladi («O'chirish»). */
  danger?: boolean;
}

export interface NotificationRowMenuProps {
  /** Kebab tugmasi va menyu nomi: «Baraka Shop — bekor qilingan guruhi: amallar». */
  label: string;
  /** Telefon varaqasi sarlavhasi: market nomi. */
  title: string;
  /** Sarlavha yonidagi kulrang «#12» (nom topilmasa — yo'q). */
  titleAddon?: string | null;
  /** Sarlavha ostidagi qator: «Bekor qilingan buyurtma · -1002184736577». */
  meta: string;
  /** Nofaol guruhda holat qatori («Nofaol» + izoh) — varaqada sarlavha ostida. */
  status?: ReactNode;
  items: readonly NotificationRowMenuItem[];
}

/** `.el-menu` (CODE-MAP 2.2): `raised` + `p-1.5`, kengligi 220 (maket); band 36 px. */
const MENU = "flex w-[220px] flex-col gap-0.5 rounded-xl border border-border bg-raised p-1.5 shadow-xl";
const ITEM_BASE =
  "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm outline-none! " +
  "transition-[background-color,color] duration-150 motion-reduce:transition-none [&>svg]:shrink-0";
const ITEM = `${ITEM_BASE} text-text hover:bg-sunken focus-visible:bg-sunken [&>svg]:text-text-muted`;
const ITEM_DANGER = `${ITEM_BASE} text-danger-fg hover:bg-danger-soft focus-visible:bg-danger-soft [&>svg]:text-danger-fg`;
const SEP = "mx-1.5 my-1 h-px shrink-0 bg-border";

/** Varaqadagi band (maket): ramkali ro'yxat, band ≥ 52 px, `px-4`, bandlar orasida chiziq. */
const SHEET_LIST = "flex flex-col overflow-hidden rounded-xl border border-border";
const SHEET_ITEM_BASE =
  "flex min-h-[52px] w-full items-center gap-3 border-t border-border px-4 py-2 text-left text-sm outline-none! " +
  "transition-[background-color] duration-150 motion-reduce:transition-none first:border-t-0 [&>svg]:shrink-0";
const SHEET_ITEM = `${SHEET_ITEM_BASE} text-text hover:bg-sunken focus-visible:bg-sunken [&>svg]:text-text-muted`;
const SHEET_ITEM_DANGER = `${SHEET_ITEM_BASE} text-danger-fg hover:bg-danger-soft focus-visible:bg-danger-soft`;

const MENU_ITEM_SELECTOR = '[role="menuitem"]:not([disabled])';

/** WAI-ARIA menu: ↓/↑ (aylanma), Home/End. `true` — tugma qayta ishlandi. */
const moveFocus = (container: HTMLElement | null, key: string): boolean => {
  const nodes = Array.from(container?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR) ?? []);
  if (nodes.length === 0) return false;
  const index = nodes.indexOf(document.activeElement as HTMLElement);
  let next: HTMLElement | undefined;
  if (key === "ArrowDown") next = nodes[(index + 1) % nodes.length];
  else if (key === "ArrowUp") next = nodes[(index - 1 + nodes.length) % nodes.length];
  else if (key === "Home") next = nodes[0];
  else if (key === "End") next = nodes[nodes.length - 1];
  if (!next) return false;
  next.focus();
  return true;
};

/**
 * TELEGRAM GURUHI QATORI MENYUSI (maketlar `*-notifications-row-menu`, `*-row-menu-inactive`; `UserRowMenu` naqshi).
 *
 * - Desktop / planshet: kebab (32 px) → popover `.el-menu` (220 px): «Nofaol qilish» yoki «Faollashtirish», chiziq,
 *   «O'chirish» (qizil). ↓/↑, Home/End, Esc (fokus tugmaga qaytadi), Tab va tashqariga bosish yopadi.
 * - Telefon (< 768): kebab 44 px → pastki varaqa (`Dialog`): sarlavha «<market> #id», «<turi> · <guruh ID>»,
 *   nofaol guruhda holat qatori, «Yopish»; bandlar ramkali ro'yxatda, har biri ≥ 52 px.
 *
 * Band tanlansa menyu yopiladi, fokus kebabga qaytadi, so'ng amal (tasdiq oynasi) chaqiriladi — tasdiq yopilganda
 * fokus yana shu tugmaga qaytadi. Varaqada amal varaqa butunlay yopilgach (`onExited`) chaqiriladi: ikki oyna
 * fokus tuzog'i bir-biriga xalaqit bermaydi.
 */
export const NotificationRowMenu = ({
  label,
  title,
  titleAddon,
  meta,
  status,
  items,
}: NotificationRowMenuProps) => {
  const isPhone = useIsPhoneViewport();
  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const pendingRef = useRef<(() => void) | null>(null);
  const menuId = useId();
  const sheetMenuRef = useRef<HTMLDivElement | null>(null);
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

  // Popover ochilganda — birinchi bandga fokus.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      floatingRef.current?.querySelector<HTMLElement>(MENU_ITEM_SELECTOR)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [floatingRef, open]);

  const handlePopoverKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      close(false);
      return;
    }
    if (moveFocus(floatingRef.current, event.key)) event.preventDefault();
  };

  const handleSheetKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (moveFocus(sheetMenuRef.current, event.key)) event.preventDefault();
  };

  const selectFromSheet = (item: NotificationRowMenuItem) => {
    pendingRef.current = item.onSelect;
    setSheetOpen(false);
  };

  const runPending = () => {
    const action = pendingRef.current;
    pendingRef.current = null;
    action?.();
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
        className="text-text-muted"
        aria-haspopup={isPhone ? "dialog" : "menu"}
        aria-expanded={isPhone ? sheetOpen : open}
        aria-controls={open ? menuId : undefined}
        onClick={(event) => {
          event.stopPropagation();
          if (isPhone) setSheetOpen(true);
          else setOpen((previous) => !previous);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open && !isPhone) {
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
            onKeyDown={handlePopoverKeyDown}
            onClick={(event) => event.stopPropagation()}
          >
            {items.map((item, index) => (
              <div key={item.key} className="contents">
                {item.danger && index > 0 ? <div role="separator" className={SEP} /> : null}
                <Pressable
                  role="menuitem"
                  tabIndex={-1}
                  className={item.danger ? ITEM_DANGER : ITEM}
                  onClick={() => {
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

      <Dialog
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onExited={runPending}
        size="sm"
        title={
          <>
            {title}
            {titleAddon ? (
              <>
                {" "}
                <span className="text-[13px] font-normal text-text-muted tabular-nums">{titleAddon}</span>
              </>
            ) : null}
          </>
        }
        description={
          <span className="flex flex-col gap-1">
            <span className="tabular-nums [overflow-wrap:anywhere]">{meta}</span>
            {status}
          </span>
        }
      >
        <div
          ref={sheetMenuRef}
          role="menu"
          aria-label={label}
          className={SHEET_LIST}
          onKeyDown={handleSheetKeyDown}
        >
          {items.map((item) => (
            <Pressable
              key={item.key}
              role="menuitem"
              className={cx(item.danger ? SHEET_ITEM_DANGER : SHEET_ITEM)}
              onClick={() => selectFromSheet(item)}
            >
              <item.icon size={18} strokeWidth={2} aria-hidden="true" />
              {item.label}
            </Pressable>
          ))}
        </div>
      </Dialog>
    </>
  );
};

export default NotificationRowMenu;
