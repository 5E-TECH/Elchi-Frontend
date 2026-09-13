import type { ReactNode } from 'react';

export interface PillOption {
  value: string;
  label: string;
  /** Sanoq — `null`/`undefined` bo'lsa ko'rsatilmaydi. */
  count?: number | null;
  icon?: ReactNode;
  /** Faol holatdagi rang (tailwind sinflari). */
  activeClass?: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: PillOption[];
}

/**
 * Filtr "pill"lari — PCS `components/FilterPills.tsx` dan ko'chirildi.
 *
 * Har birida ixtiyoriy sanoq: operator bir qarashda qaysi guruhda nechta
 * yozuv borligini ko'radi. antd `Segmented` dan ko'ra boyroq, chunki sanoq
 * va rang bilan birga keladi — "xato" pili qizil bo'lsa va yonida `3`
 * turgan bo'lsa, bosishdan oldin muammo borligi ma'lum.
 *
 * ⚠️ `count` ATAYLAB `null` ni ham qabul qiladi: "hali sanalmagan" va "nol"
 * bir xil emas. `null` bo'lsa badge umuman chizilmaydi — `0` deb ko'rsatish
 * "bo'sh" degan yolg'on xabar bo'lardi.
 */
export const FilterPills = ({ value, onChange, options }: Props) => (
  <div className="flex flex-wrap items-center gap-1.5">
    {options.map((o) => {
      const active = value === o.value;
      const activeCls =
        o.activeClass ?? 'bg-violet-600 text-white border-violet-600';
      return (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={active}
          className={`group inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
            active
              ? `${activeCls} shadow-sm`
              : 'border-gray-200 bg-white text-gray-600 hover:border-violet-300 hover:text-violet-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300 dark:hover:text-violet-400'
          }`}
        >
          {o.icon}
          <span>{o.label}</span>
          {o.count != null && (
            <span
              className={`inline-flex min-w-[20px] justify-center rounded-full px-1.5 text-xs font-semibold ${
                active
                  ? 'bg-white/25 text-white'
                  : 'bg-gray-100 text-gray-600 group-hover:bg-violet-100 group-hover:text-violet-700 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {o.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

export default FilterPills;
