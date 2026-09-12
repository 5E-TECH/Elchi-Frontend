import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Cable,
  FileClock,
  LayoutDashboard,
  Loader2,
  Plus,
  Settings as SettingsIcon,
} from 'lucide-react';
import { ROLE_META, CATEGORY_LABEL } from '../../entities/integrations';
import ConnectionSubNav, { type SubNavItem } from './ConnectionSubNav';
import { ROLE_ORDER } from './connections';
import { groupByRole, useConnections, type Connection } from './useConnections';
import ConnectionOverview from './panels/ConnectionOverview';
import ConnectionSettings from './panels/ConnectionSettings';
import ConnectionLog from './panels/ConnectionLog';

/**
 * INTEGRATSIYALAR — yagona boshqaruv yuzasi.
 *
 * NEGA QAYTA TUZILDI. Ilgari bu yuza ikki sahifaga bo'lingan edi —
 * "Hamkorlar (API)" va "Tashqi tizimlar" — va har birida o'z formasi,
 * o'z terminologiyasi bor edi. Foydalanuvchi uchun esa ikkisi bitta ish:
 * "tashqi tizim bilan ulanishni sozlash". Natija: qaysi sozlamani qaysi
 * sahifada qilishni bilmaslik.
 *
 * Naqsh PCS'dan olindi (`ProvidersTab` + `ProviderSubNav`), u yerda ikki
 * provayder ustida tasdiqlangan:
 *
 *     ULANISH TANLAGICHI  (rol bo'yicha guruhlangan)
 *           ↓
 *     SUB-NAV: Umumiy holat · Sozlamalar · Jurnal
 *           ↓
 *     tanlangan panel
 *
 * Panellar UMUMIY: ular ulanish TURIGA qarab boshqa maydon ko'rsatadi, lekin
 * ko'rinishi va joyi bir xil. Shu bois operator yangi tizim ulaganda qayerni
 * bosishni qaytadan o'rganmaydi.
 *
 * ⚠️ Tanlangan ulanish URL'da saqlanadi (`?c=partner:7`) — sahifani
 * yangilash yoki havola yuborish tanlovni yo'qotmasligi kerak.
 */
const ConnectionsPage = () => {
  const { connections, isLoading, isError, partialError, refetch } =
    useConnections();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState('overview');

  const activeUid = searchParams.get('c') ?? '';
  const active = useMemo(
    () => connections.find((c) => c.uid === activeUid) ?? connections[0],
    [connections, activeUid],
  );

  /**
   * Ro'yxat yuklangach URL'ni birinchi ulanish bilan to'ldiramiz — aks holda
   * panel ko'rinib turadi-yu, URL bo'sh qoladi va sahifani yangilaganda
   * boshqa ulanishga o'tib ketishi mumkin.
   */
  useEffect(() => {
    if (!activeUid && active) {
      const next = new URLSearchParams(searchParams);
      next.set('c', active.uid);
      setSearchParams(next, { replace: true });
    }
  }, [activeUid, active, searchParams, setSearchParams]);

  const select = (uid: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('c', uid);
    setSearchParams(next, { replace: true });
    // Yangi ulanishga o'tganda birinchi tabga qaytamiz: "Jurnal" tabida
    // turib boshqa ulanishga o'tish chalkash bo'lardi.
    setTab('overview');
  };

  const groups = groupByRole(connections, ROLE_ORDER);

  const items: SubNavItem[] = active
    ? [
        {
          key: 'overview',
          label: 'Umumiy holat',
          icon: <LayoutDashboard className="h-4 w-4" />,
          desc: 'Tayyorlik va raqamlar',
          content: <ConnectionOverview connection={active} />,
        },
        {
          key: 'settings',
          label: 'Sozlamalar',
          icon: <SettingsIcon className="h-4 w-4" />,
          desc: 'Ulanish qiymatlari',
          content: <ConnectionSettings connection={active} onSaved={refetch} />,
        },
        {
          key: 'log',
          label: 'Jurnal',
          icon: <FileClock className="h-4 w-4" />,
          desc: 'Hodisalar va xatolar',
          content: <ConnectionLog connection={active} />,
        },
      ]
    : [];

  const activeItem = items.find((i) => i.key === tab) ?? items[0];

  if (isLoading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Loader2 className="animate-spin text-main" size={26} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm font-semibold text-red-700 dark:text-red-300">
        Ulanishlar ro'yxatini olib bo'lmadi.
        <button
          type="button"
          onClick={refetch}
          className="ml-2 underline underline-offset-2"
        >
          Qayta urinish
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Qismiy xato — ro'yxat to'liq emasligini AYTISH kerak, aks holda
          operator "ulanish yo'q" deb o'ylardi. */}
      {partialError && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
          Ro'yxatning bir qismini olib bo'lmadi — hamma ulanish ko'rinmayotgan
          bo'lishi mumkin.
        </div>
      )}

      {/* ═══════ ULANISH TANLAGICHI ═══════ */}
      <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-4 shadow-sm dark:bg-primarydark">
        {connections.length === 0 ? (
          <p className="m-0 text-sm text-[color:var(--color-text-muted)]">
            Hali ulanish yo'q. Birinchisini qo'shish uchun "Yangi ulanish".
          </p>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.role}>
                <p
                  className="m-0 mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]"
                  title={ROLE_META[group.role].hint}
                >
                  {ROLE_META[group.role].label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((c) => (
                    <ConnectionCard
                      key={c.uid}
                      connection={c}
                      active={c.uid === active?.uid}
                      onClick={() => select(c.uid)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/*
          "Yangi ulanish" — hozircha o'chirilgan.

          Ulanish yaratish ikki xil endpointga boradi (`partners` yoki
          `external_integrations`) va har turda boshqa majburiy maydonlar bor.
          Uni "ishlaydi" qilib ko'rsatib, keyin yarim ishlashi operatorni
          chalg'itardi — tushuntirish bilan turgani halolroq.
        */}
        <div className="mt-3 border-t border-[color:var(--color-border-soft)] pt-3">
          <button
            type="button"
            disabled
            title="Yangi ulanish qo'shish keyingi bosqichda — hozir mavjud ulanishlarni sozlash mumkin"
            className="flex cursor-not-allowed items-center gap-2 rounded-xl border border-dashed border-[color:var(--color-border-soft)] px-4 py-2 text-sm font-semibold text-[color:var(--color-text-muted)]"
          >
            <Plus className="h-4 w-4" />
            Yangi ulanish
          </button>
        </div>
      </div>

      {/* ═══════ TANLANGAN ULANISH PANELI ═══════ */}
      {active && activeItem && (
        <div className="space-y-4">
          <ConnectionSubNav items={items} active={activeItem.key} onChange={setTab} />
          <div>{activeItem.content}</div>
        </div>
      )}
    </div>
  );
};

/** Ro'yxatdagi bitta ulanish kartasi. */
const ConnectionCard = ({
  connection,
  active,
  onClick,
}: {
  connection: Connection;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex max-w-full shrink-0 cursor-pointer items-center gap-2.5 rounded-xl border-2 px-3.5 py-2.5 text-left transition-all ${
      active
        ? 'border-main bg-main/10 shadow-sm'
        : 'border-[color:var(--color-border-soft)] bg-white hover:border-main/40 dark:bg-white/[0.04]'
    }`}
  >
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
        active
          ? 'bg-main text-white'
          : 'bg-maindark/5 text-maindark/50 dark:bg-white/10 dark:text-primary/60'
      }`}
    >
      <Cable className="h-4 w-4" />
    </span>
    <span className="min-w-0">
      <span className="flex items-center gap-1.5">
        <span
          className={`truncate text-sm font-bold leading-tight ${
            active ? 'text-main' : 'text-maindark dark:text-primary'
          }`}
        >
          {connection.name}
        </span>
        {/* O'chirilgan ulanish ro'yxatda DARHOL ko'rinishi kerak — aks holda
            "nega ishlamayapti" degan savol paydo bo'ladi. */}
        {!connection.is_active && (
          <span className="shrink-0 rounded-full bg-red-500/12 px-1.5 text-[10px] font-bold text-red-700 dark:text-red-300">
            o'chiq
          </span>
        )}
      </span>
      <span className="block truncate text-[11px] leading-tight text-[color:var(--color-text-muted)]">
        {CATEGORY_LABEL[connection.category]} · {connection.subtitle}
      </span>
    </span>
  </button>
);

export default ConnectionsPage;
