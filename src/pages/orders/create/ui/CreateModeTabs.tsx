import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, PencilLine, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

export type CreateMode = "manual" | "ai";

type ModeTab = {
  id: CreateMode;
  labelKey: string;
  icon: ReactNode;
};

const modeTabs: ModeTab[] = [
  { id: "manual", labelKey: "aiModeManual", icon: <PencilLine size={16} /> },
  { id: "ai", labelKey: "aiModeAi", icon: <Sparkles size={16} /> },
];

/**
 * "Qo'lda" / "AI bilan" rejimlari. Naqsh — buyurtmalar ro'yxatidagi
 * `tabs.tsx`: 640px dan kichikda dropdown, kattada yonma-yon tugmalar.
 * ⚠️ Tugmalar `type="button"` — sahifa `<form>` ichida, aks holda tab
 * bosilganda qo'lda forma submit bo'lardi.
 */
const CreateModeTabs = ({ mode, onChange }: { mode: CreateMode; onChange: (mode: CreateMode) => void }) => {
  const { t } = useTranslation("orders");
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const mobileRef = useRef<HTMLDivElement | null>(null);
  const activeTab = modeTabs.find((tab) => tab.id === mode) ?? modeTabs[0];

  useEffect(() => {
    if (!isMobileOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (mobileRef.current && !mobileRef.current.contains(event.target as Node)) {
        setIsMobileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobileOpen]);

  const select = (next: CreateMode) => {
    setIsMobileOpen(false);
    if (next !== mode) onChange(next);
  };

  const tabClassName = (isActive: boolean) => `
    flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-center
    cursor-pointer font-semibold text-sm transition-all duration-200
    ${
      isActive
        ? "bg-main text-primary shadow-md shadow-main/20"
        : "border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-200 hover:border-main/40 hover:text-main"
    }
  `;

  return (
    <div data-testid="create-mode-tabs">
      <div ref={mobileRef} className="sm:hidden">
        <button
          type="button"
          onClick={() => setIsMobileOpen((prev) => !prev)}
          aria-expanded={isMobileOpen}
          className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl bg-main px-4 py-3 text-left text-sm font-semibold text-primary shadow-md shadow-main/20"
        >
          <span className="flex min-w-0 items-center gap-2">
            {activeTab.icon}
            <span className="truncate">{t(activeTab.labelKey)}</span>
          </span>
          <ChevronDown size={18} className={`shrink-0 transition-transform ${isMobileOpen ? "rotate-180" : ""}`} />
        </button>

        {isMobileOpen && (
          <div className="mt-2 space-y-2 rounded-xl border border-gray-300/60 p-2 dark:border-gray-600/60">
            {modeTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={tab.id === mode}
                onClick={() => select(tab.id)}
                className={tabClassName(tab.id === mode)}
              >
                {tab.icon}
                {t(tab.labelKey)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div role="tablist" className="hidden grid-cols-2 gap-2 sm:grid">
        {modeTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === mode}
            onClick={() => select(tab.id)}
            className={tabClassName(tab.id === mode)}
          >
            {tab.icon}
            {t(tab.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
};

export default memo(CreateModeTabs);
