import { memo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * MobileCollapsibleSection — og'ir bloklarni (Moliyaviy tahlil, Hududlar
 * xaritasi) telefonda yopiq akkordeon qilib ko'rsatadi, foydalanuvchi
 * bosganda ochiladi. Desktop/planshetda (sm+, 640px+) har doim ochiq —
 * xatti-harakat o'zgarmaydi, faqat boshlang'ich holat farqlanadi.
 *
 * `window.matchMedia` test muhitida (src/test/setup.ts) har doim
 * `matches: false` qaytaradi, shuning uchun testlarda bu blok har doim
 * ochiq holatda render bo'ladi — mavjud testlar buzilmaydi.
 */

const isMobileViewport = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(max-width: 639px)").matches;

export interface MobileCollapsibleSectionProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

const MobileCollapsibleSection = memo(
  ({ title, icon, children, className = "" }: MobileCollapsibleSectionProps) => {
    const [open, setOpen] = useState(() => !isMobileViewport());

    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="el-glass-control flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left sm:hidden"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-maindark dark:text-primary">
            {icon}
            {title}
          </span>
          <ChevronDown
            size={18}
            className={`shrink-0 text-current transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>
        <div className={open ? "mt-2 sm:mt-0" : "hidden sm:block"}>{children}</div>
      </div>
    );
  },
);

MobileCollapsibleSection.displayName = "MobileCollapsibleSection";

export default MobileCollapsibleSection;
