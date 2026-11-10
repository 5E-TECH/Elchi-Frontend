// dizayn-v2: superadmin-payments-main-cashbox-accounts
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Ellipsis, type LucideIcon } from "lucide-react";
import { cx } from "../../../../shared/lib/cx";
import { IconButton, Portal, Pressable, useDismiss, usePopover } from "../../../../shared/ui/primitives";

export type CashboxCardMenuItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Berilmasa — o'chiq band (`hint` bilan sababi: «Asosiy kartani o'chirib bo'lmaydi»). */
  onSelect?: () => void;
  danger?: boolean;
  /** O'chiq bandning ostidagi izoh. */
  hint?: string;
};

/** `.el-menu` (CODE-MAP 2.2): band 36 px (telefonda 44), xavfli band — qizil, oldidan chiziq. */
const MENU = "flex min-w-[208px] max-w-[280px] flex-col gap-0.5 rounded-xl border border-border bg-raised p-1.5 shadow-xl";
const ITEM_BASE =
  "flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm outline-none! " +
  "transition-[background-color,color] duration-150 motion-reduce:transition-none max-md:min-h-11 [&>svg]:shrink-0";
const ITEM = `${ITEM_BASE} text-text hover:bg-sunken focus-visible:bg-sunken [&>svg]:text-text-muted`;
const ITEM_DANGER = `${ITEM_BASE} text-danger-fg hover:bg-danger-soft focus-visible:bg-danger-soft [&>svg]:text-danger-fg`;
const ITEM_DISABLED = `${ITEM_BASE} cursor-not-allowed text-text-subtle [&>svg]:text-text-subtle`;
const SEP = "mx-1.5 my-1 h-px shrink-0 bg-border";

/**
 * KARTA QATORI AMALLARI (kebab «{nom} amallari»; `widgets/branch-list/ui/BranchRowMenu` naqshi): WAI-ARIA menu —
 * ↓/↑ (aylanma), Home/End, Esc (fokus tugmaga) va Tab yopadi, tashqariga bosish yopadi. Band tanlansa menyu yopiladi
 * (fokus kebab tugmasiga — ochilgan oyna yopilganda shu yerga qaytadi), so'ng amal chaqiriladi. O'chiq band
 * (`aria-disabled`) — sababi ostida (Asosiy kartani o'chirib bo'lmaydi).
 */
export const CashboxCardRowMenu = ({ label, items }: { label: string; items: readonly CashboxCardMenuItem[] }) => {
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
            aria-label={label}
            style={floatingStyles}
            className={MENU}
            onKeyDown={handleMenuKeyDown}
          >
            {items.map((item, index) => {
              const disabled = !item.onSelect;
              const hintId = `${menuId}-${item.key}-hint`;
              return (
                <div key={item.key} className="contents">
                  {item.danger && index > 0 ? <div role="separator" className={SEP} /> : null}
                  <Pressable
                    role="menuitem"
                    tabIndex={-1}
                    aria-disabled={disabled || undefined}
                    aria-describedby={item.hint ? hintId : undefined}
                    className={cx(disabled ? ITEM_DISABLED : item.danger ? ITEM_DANGER : ITEM)}
                    onClick={() => {
                      if (!item.onSelect) return;
                      close(true);
                      item.onSelect();
                    }}
                  >
                    <item.icon size={18} strokeWidth={2} aria-hidden="true" />
                    <span className="flex min-w-0 flex-col">
                      <span>{item.label}</span>
                      {item.hint ? (
                        <span id={hintId} className="text-xs text-text-subtle">
                          {item.hint}
                        </span>
                      ) : null}
                    </span>
                  </Pressable>
                </div>
              );
            })}
          </div>
        </Portal>
      ) : null}
    </>
  );
};
