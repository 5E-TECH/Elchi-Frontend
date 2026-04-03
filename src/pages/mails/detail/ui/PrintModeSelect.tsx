import { memo, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, FileText, Globe, Printer, ReceiptText } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PrintMode } from "../lib/printMode";

type MenuPosition = { top: number; left: number };

type Props = {
  variant?: "header" | "icon";
  count?: number;
  disabled?: boolean;
  onSelect: (mode: PrintMode) => void;
};

const PrintModeSelect = ({
  variant = "header",
  count = 0,
  disabled = false,
  onSelect,
}: Props) => {
  const { t } = useTranslation("mails");
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<MenuPosition | null>(null);

  const options = useMemo(
    () => [
      {
        id: "browser" as const,
        label: t("printOptions.browser.label"),
        hint: t("printOptions.browser.hint"),
        icon: <Globe size={14} className="text-[var(--color-info)]" />,
      },
      {
        id: "pdf_100x60" as const,
        label: t("printOptions.labelPdf.label"),
        hint: t("printOptions.labelPdf.hint"),
        icon: <FileText size={14} className="text-[var(--color-error)]" />,
      },
      {
        id: "thermal_80mm" as const,
        label: t("printOptions.thermal.label"),
        hint: t("printOptions.thermal.hint"),
        icon: <ReceiptText size={14} className="text-[var(--color-success)]" />,
      },
    ],
    [t],
  );

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
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
      const MENU_WIDTH = 288; // w-72
      const GAP = 8;
      const nextTop = rect.bottom + GAP;
      const preferredLeft = rect.left;
      const clampedLeft = Math.max(GAP, Math.min(preferredLeft, window.innerWidth - MENU_WIDTH - GAP));
      setPos({ top: nextTop, left: clampedLeft });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    document.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      document.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const handlePick = (mode: PrintMode) => {
    onSelect(mode);
    setOpen(false);
  };

  const triggerDisabled = disabled || (variant === "header" && count === 0);

  return (
    <>
      {variant === "header" ? (
        <button
          ref={triggerRef}
          type="button"
          disabled={triggerDisabled}
          onClick={() => setOpen((v) => !v)}
          className={`
            flex items-center gap-2
            px-4 py-2 rounded-xl
            bg-[var(--color-glass)]
            border border-[var(--color-purple-light)]
            text-[var(--color-purple-light)]
            hover:opacity-95
            transition-opacity
            ${triggerDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          `}
          aria-label={t("print")}
        >
          <Printer size={16} className="text-[var(--color-purple-light)]" />
          <span className="text-sm font-semibold">
            {t("print")} ({count})
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
          onClick={() => setOpen((v) => !v)}
          className={`
            flex items-center justify-center w-7 h-7 rounded-lg
            bg-gray-100 dark:bg-white/8
            text-black dark:text-white/60
            hover:bg-main/10 hover:text-main
            dark:hover:bg-main/20 dark:hover:text-white
            transition-all duration-200 shrink-0
            ${triggerDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          `}
          aria-label={t("print")}
        >
          <Printer size={13} />
        </button>
      )}

      {open && pos && createPortal(
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
          aria-label={t("printMenu")}
        >
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handlePick(opt.id)}
              className="
                w-full px-4 py-3
                flex items-center gap-3 text-left
                hover:bg-[var(--color-glass)] transition-colors
              "
            >
              <div className="shrink-0">{opt.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[var(--color-primary)] truncate">{opt.label}</div>
                <div className="text-xs text-[var(--color-primary)] opacity-55 truncate">{opt.hint}</div>
              </div>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
};

export default memo(PrintModeSelect);
