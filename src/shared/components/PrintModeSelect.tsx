import { memo, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Printer } from "lucide-react";

type MenuPosition = { top: number; left: number };

export type PrintSelectOption = {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
};

type Props = {
  variant?: "header" | "icon";
  count?: number;
  disabled?: boolean;
  onSelect: (mode: string) => void;
  className?: string;
  buttonLabel?: string;
  menuLabel?: string;
  options: PrintSelectOption[];
};

const PrintModeSelect = ({
  variant = "header",
  count = 0,
  disabled = false,
  onSelect,
  className = "",
  buttonLabel = "Print",
  menuLabel = "Print menu",
  options,
}: Props) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<MenuPosition | null>(null);

  const normalizedOptions = useMemo(() => options, [options]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuWidth = 288;
      const gap = 8;
      const top = rect.bottom + gap;
      const left = Math.max(gap, Math.min(rect.left, window.innerWidth - menuWidth - gap));
      setPos({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    document.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      document.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const handlePick = (mode: string) => {
    onSelect(mode);
    setOpen(false);
  };

  const triggerDisabled =
    disabled || normalizedOptions.length === 0 || (variant === "header" && count === 0);

  return (
    <>
      {variant === "header" ? (
        <button
          ref={triggerRef}
          type="button"
          disabled={triggerDisabled}
          onClick={() => setOpen((value) => !value)}
          className={`
            flex items-center justify-center gap-2
            px-4 py-3 rounded-2xl
            bg-[var(--color-glass)]
            border border-[var(--color-purple-light)]
            text-[var(--color-purple-light)]
            hover:opacity-95
            transition-opacity
            ${triggerDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            ${className}
          `}
          aria-label={buttonLabel}
        >
          <Printer size={16} className="text-[var(--color-purple-light)]" />
          <span className="text-sm font-semibold">
            {buttonLabel} ({count})
          </span>
          <ChevronDown
            size={16}
            className={`text-[var(--color-purple-light)] transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          disabled={triggerDisabled}
          onClick={() => setOpen((value) => !value)}
          className={`
            flex items-center justify-center w-7 h-7 rounded-lg
            bg-gray-100 dark:bg-white/8
            text-black dark:text-white/60
            hover:bg-main/10 hover:text-main
            dark:hover:bg-main/20 dark:hover:text-white
            transition-all duration-200 shrink-0
            ${triggerDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          `}
          aria-label={buttonLabel}
        >
          <Printer size={13} />
        </button>
      )}

      {open && pos
        ? createPortal(
            <div
              ref={menuRef}
              style={{ position: "fixed", top: pos.top, left: pos.left }}
              className="
                z-[9999] w-72
                rounded-xl overflow-hidden
                bg-[var(--color-surface-dark)]
                border border-[var(--color-glass-border)]
                shadow-2xl shadow-black/30
              "
              role="dialog"
              aria-label={menuLabel}
            >
              {normalizedOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handlePick(option.id)}
                  className="
                    w-full px-4 py-3
                    flex items-center gap-3 text-left
                    hover:bg-[var(--color-glass)] transition-colors
                  "
                >
                  <div className="shrink-0">{option.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[var(--color-primary)] truncate">
                      {option.label}
                    </div>
                    {option.hint ? (
                      <div className="text-xs text-[var(--color-primary)] opacity-55 truncate">
                        {option.hint}
                      </div>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
};

export default memo(PrintModeSelect);
