import type { ReactNode } from 'react';
import { BODY, BORDER, FAINT } from './ui';

export interface SubNavItem {
  key: string;
  label: string;
  icon: ReactNode;
  desc: string;
  content: ReactNode;
}

interface Props {
  items: SubNavItem[];
  active: string;
  onChange: (key: string) => void;
}

/**
 * Ulanish paneli ichidagi sub-tab navigatsiyasi.
 *
 * PCS'ning `ProviderSubNav` komponentidan olingan — u ikki provayderda
 * tasdiqlangan shakl. Ranglar ham o'sha yerdan: aniq Tailwind shkalasi
 * (`gray-700`/`gray-400`) va VIOLET urg'u.
 *
 * ⚠️ URG'U IKKI DARAJADA: ulanish chipi INDIGO, sub-nav VIOLET. Bu tasodif
 * emas — operator qaysi darajada turganini rangdan ajratadi. Ikkisi bir xil
 * rangda bo'lsa, "qaysi biri tanlangan" degan savol paydo bo'lardi.
 *
 * Telefonda faqat yorliq ko'rinadi (tavsif yashiriladi) — joy yetmaydi va
 * ikki qatorli chip ekranni egallab ketardi.
 */
export const ConnectionSubNav = ({ items, active, onChange }: Props) => (
  <div className="flex items-center gap-2 overflow-x-auto pb-1">
    {items.map((it) => {
      const on = it.key === active;
      return (
        <button
          key={it.key}
          type="button"
          onClick={() => onChange(it.key)}
          aria-current={on ? 'true' : undefined}
          className={`group flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-all ${
            on
              ? 'border-violet-500 bg-violet-50 shadow-sm dark:bg-violet-900/25'
              : `${BORDER} bg-white hover:border-violet-300 dark:bg-gray-800/50 dark:hover:border-violet-700`
          }`}
        >
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              on
                ? 'bg-violet-600 text-white'
                : 'bg-gray-100 text-gray-500 group-hover:text-violet-600 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            {it.icon}
          </span>

          <span className="hidden sm:block">
            <span
              className={`block text-sm font-semibold leading-tight ${
                on ? 'text-violet-700 dark:text-violet-300' : BODY
              }`}
            >
              {it.label}
            </span>
            <span className={`block text-[11px] leading-tight ${FAINT}`}>
              {it.desc}
            </span>
          </span>

          <span
            className={`text-sm font-semibold sm:hidden ${
              on ? 'text-violet-700 dark:text-violet-300' : BODY
            }`}
          >
            {it.label}
          </span>
        </button>
      );
    })}
  </div>
);

export default ConnectionSubNav;
