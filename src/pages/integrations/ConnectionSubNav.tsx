import type { ReactNode } from 'react';

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
 * UMUMIY komponent — barcha ulanish turi (marketplace, yetkazuvchi, to'lov
 * tizimi, ko'zgu) AYNI shu navni ishlatadi. Har tur uchun nusxa ko'chirilsa,
 * ular asta bir-biridan farq qila boshlardi va foydalanuvchi har ulanishda
 * boshqa joyni bosishga o'rganishi kerak bo'lardi.
 *
 * Naqsh PCS'dagi `ProviderSubNav`dan olindi (u yerda ikki provayder ustida
 * tasdiqlangan), Elchi dizayn tokenlariga (`--color-*`, `bg-main`) moslandi.
 *
 * Kichik ekranda faqat yorliq ko'rinadi — tavsif sig'maydi va uni siqib
 * ko'rsatish o'qishni qiyinlashtiradi.
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
          title={it.desc}
          className={`group flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-all ${
            on
              ? 'border-main bg-main/10 shadow-sm'
              : 'border-[color:var(--color-border-soft)] bg-white hover:border-main/40 dark:bg-white/[0.04]'
          }`}
        >
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              on
                ? 'bg-main text-white'
                : 'bg-maindark/5 text-maindark/50 group-hover:text-main dark:bg-white/10 dark:text-primary/60'
            }`}
          >
            {it.icon}
          </span>
          <span className="hidden sm:block">
            <span
              className={`block text-sm font-semibold leading-tight ${
                on ? 'text-main' : 'text-maindark dark:text-primary'
              }`}
            >
              {it.label}
            </span>
            <span className="block text-[11px] leading-tight text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
              {it.desc}
            </span>
          </span>
          <span
            className={`text-sm font-semibold sm:hidden ${
              on ? 'text-main' : 'text-maindark dark:text-primary'
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
