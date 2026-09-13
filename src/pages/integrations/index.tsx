import { useMemo } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Cable, LayoutGrid, ScanLine } from 'lucide-react';
import { INTEGRATION_TABS } from './tabs';

/**
 * INTEGRATSIYALAR UYI — barcha tashqi ulanishlar uchun yagona yuza.
 *
 * NEGA KERAK BO'LDI. Elchi'da integratsiya IKKI joyda boshqarilardi va
 * ikkalasi ham "Integratsiyalar" deb nomlanardi:
 *
 *   `/partners`                  — bizga API orqali ulanadigan tizimlar
 *   `/new-orders/integrations`   — biz ulanadigan tashqi tizimlar (CRUD)
 *
 * Ikkinchisi "Yangi buyurtmalar" sahifasining ichida turardi — ya'ni
 * integratsiya QO'SHISH/O'CHIRISH kunlik buyurtma ekranining ichida edi.
 * Foydalanuvchi ikkisining farqini ajratmasdi va sozlamani qaysi joyda
 * qilishni bilmasdi.
 *
 * Endi bittasi: yo'nalish bo'yicha ajratilgan tablar.
 *
 * ⚠️ ESKI MARSHRUTLAR SAQLANADI (redirect bilan). Ular tashqi hujjatlarda,
 * xatcho'plarda va Telegram xabarlarida bo'lishi mumkin.
 *
 * ⚠️ Ruxsat tekshiruvi BU YERDA emas — har bir tabning o'z marshrutida
 * `ProtectedRoute` bilan. Uy faqat navigatsiya: bir tabga ruxsati yo'q
 * foydalanuvchi boshqasini ko'ra olishi kerak.
 */

const ICONS: Record<string, React.ReactNode> = {
  partners: <ArrowDownLeft size={16} />,
  sources: <ArrowUpRight size={16} />,
  incoming: <ScanLine size={16} />,
};

const IntegrationsPage = () => {
  const location = useLocation();

  /**
   * Zaxira yuzada turibmizmi. Ildiz (`/integrations`) — asosiy yuza, qolgani
   * eski sahifalar.
   */
  const isLegacy = INTEGRATION_TABS.some((tab) =>
    location.pathname.startsWith(`/integrations/${tab.path}`),
  );

  const active = useMemo(() => {
    /**
     * Eng UZUN mos keladigan segment tanlanadi. `startsWith` bilan qisqa
     * yo'l ("sources") uzunini ("sources/create") ham qamrab oladi, lekin
     * teskarisi bo'lmasligi uchun tartib muhim emas — biz uzunlik bo'yicha
     * saralaymiz.
     */
    const matches = INTEGRATION_TABS.filter((tab) =>
      location.pathname.startsWith(`/integrations/${tab.path}`),
    ).sort((a, b) => b.path.length - a.path.length);
    return matches[0] ?? INTEGRATION_TABS[0];
  }, [location.pathname]);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white p-4 shadow-sm dark:bg-gray-800/50">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-900/25 text-indigo-600 dark:text-indigo-300">
            <Cable size={20} />
          </span>
          <div className="min-w-0">
            <h1 className="m-0 text-lg font-extrabold text-gray-800 dark:text-white">
              Integratsiyalar
            </h1>
            <p className="m-0 mt-1 text-xs text-gray-500 dark:text-gray-400">
              Tashqi tizimlar bilan barcha ulanishlar — bir joyda
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {/*
            ASOSIY YUZA — barcha ulanish bitta ro'yxatda. Ilgari bu yer ikki
            tabga bo'lingan edi va foydalanuvchi qaysi sozlamani qayerda
            qilishni bilmasdi.
          */}
          {/*
            IKKI ASOSIY YUZA. Manzara — "hammasi qalay?", Konsol — "bu
            ulanish qalay?". Ular bir-birini almashtirmaydi, ketma-ket
            turadi: jadvaldagi "Ochish" konsolga olib boradi.
          */}
          <NavLink
            to="/integrations"
            end
            className={({ isActive }) =>
              `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-all ${
                isActive
                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-200'
              }`
            }
          >
            <LayoutGrid size={16} />
            Manzara
          </NavLink>
          <NavLink
            to="/integrations/connections"
            className={({ isActive }) =>
              `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-all ${
                isActive
                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-200'
              }`
            }
          >
            <Cable size={16} />
            Konsol
          </NavLink>

          {/*
            ZAXIRA yuzalar — yangi yuza to'liq ishlagani tasdiqlanmaguncha
            saqlanadi. Ataylab kichraytirilgan: ular asosiy yo'l emas.
          */}
          <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />
          {INTEGRATION_TABS.map((tab) => {
            const on = tab.key === active.key && isLegacy;
            return (
              <NavLink
                key={tab.key}
                to={`/integrations/${tab.path}`}
                title={tab.hint}
                className={`inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-xs font-semibold transition-all ${
                  on
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/25 dark:text-indigo-300'
                    : 'border-gray-200 text-gray-500 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-400'
                }`}
              >
                {ICONS[tab.key]}
                {tab.label}
              </NavLink>
            );
          })}
        </div>

        {/* Zaxira yuzada turganda nega u yerda ekanini aytamiz. */}
        {isLegacy && (
          <p className="m-0 mt-3 text-xs text-gray-500 dark:text-gray-400">
            {active.hint}
          </p>
        )}
      </div>

      <Outlet />
    </div>
  );
};

export default IntegrationsPage;
