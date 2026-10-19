// dizayn-v2: shell
import { memo, Suspense, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "../header/ui/Header";
import Sidebar from "../Sidebar/ui/Sidebar";
import BottomNav from "../Sidebar/ui/BottomNav";
import MobileMenu from "../Sidebar/ui/MobileMenu";
import { ScannerHost } from "../scanner";
import { useMobileMenu } from "../Sidebar/model/shellNav";
import { useShellScroll } from "./model/useShellScroll";
import { setShellBannerSlot } from "../../shared/lib/shellBannerSlot";
import RouteProgress, { RouteSuspenseFallback } from "./ui/RouteProgress";

/** Yon menyu ko'rinadigan kenglik (Tailwind `lg`). Undan torda — menyu tugmasi + suriluvchi menyu. */
export const SHELL_DESKTOP_QUERY = "(min-width: 1024px)";

/**
 * SHELL (maket `.el-app` / `.el-main` / `.el-topbar` / `.el-content`, design/kit/helmet.html).
 *
 * Bitta kanvas: sahifa foni `bg`, kontent KARTA EMAS — `max-w-[1440px]`, undan keng ekranda MARKAZDA
 * (`mx-auto`; taxta `tizim-responsive`: «Mazmun 1440 px dan kengaymaydi — katta ekranda markazda turadi»),
 * chekkalar maketdagidek: ≥ 1024: 24px 32px 48px · < 1024: 16px 16px 88px (`@container el (max-width:1023px)`).
 * Sahifaning ichki ritmi (sarlavha → bo'limlar, `gap-6` / telefonda `gap-4`) sahifaning o'z ildizida.
 *
 * Slotlar (har birini o'z quruvchisi to'ldiradi, shell faqat joy beradi):
 *   - `sidebar`   — faqat ≥ 1024 (`hidden lg:flex`), balandlik to'liq; kenglik `Sidebar` ning o'zida
 *                   (maket 248px; yig'ilgan holat — Sidebar qarori).
 *   - `topbar`    — `Header`: balandligi 64px (`h-16`), `shrink-0`; < 1024 da menyu tugmasi `onMenuClick`
 *                   (yoki `useMobileMenu().open`) bilan suriluvchi menyuni ochadi. Slot `z-40` — undagi
 *                   ochiladigan ro'yxatlar (profil menyusi) `<main>` VA pastki menyu (`z-30`) ustida chiqadi
 *                   (taxta `tizim-motion` 08: «Ochiladigan» qatlam «Yopishqoq»dan yuqori; aks holda telefon
 *                   yotiq holatida profil menyusining pastki bandlari pastki menyu ostida qolardi);
 *                   yuqori chiziq (`RouteProgress`) `z-50`.
 *   - `banner`    — sahifa bannerlari (taxta `tizim-feedback` 04: sessiya tugashi): yuqori panel ostida, oqimda,
 *                   `shrink-0` — `<main>` dan tashqarida, shuning uchun skrollda panel bilan birga qoladi va sahifani
 *                   pastga suradi («hech narsani yopmaydi»). Bo'sh bo'lsa balandligi 0. Bannerlar unga portal qiladi
 *                   (`shared/lib/shellBannerSlot.ts`). Maket talabi bilan qo'shilgan slot (4-bosqich G3).
 *   - `<main>`    — YAGONA skroll konteyneri (`useShellScroll`: yo'l o'zgarsa tepaga).
 *   - `bottomnav` — faqat telefonda (< 768, `md:hidden`). `BottomNav` `fixed inset-x-0 bottom-0`,
 *                   balandligi 64px + `env(safe-area-inset-bottom)`; ustun pastdan shuncha joy qoldiradi
 *                   (`--shell-bottomnav-h`), kontent pastki menyu ostida qolmaydi.
 *   - `MobileMenu` — < 1024, holati `useMobileMenu()` (redux `sidebar.isMobileMenuOpen`). Ochiq paytda
 *                   orqa fon `inert`.
 *   - `ScannerHost` — kontekstli skaner oynasi (ega roziligi 2026-10-19, skaner 1-bosqichi): «Skaner» /
 *                   «Skanerlash» faol skan maqsadi bo'lsa kamerani shu sahifa ustida ochadi (`openScanner`).
 */
const DashboardLayout = () => {
  const { isOpen: isMenuOpen, open: openMenu, close: closeMenu } = useMobileMenu();
  const { pathname } = useLocation();
  const scrollRef = useRef<HTMLElement>(null);
  useShellScroll(scrollRef);

  // Bo'lim almashsa suriluvchi menyu yopiladi (band bosilganda yoki «Orqaga» bilan).
  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  // Ekran ≥ 1024 ga kengaysa menyu ko'rinmaydi (`lg:hidden`) — ochiq qolsa orqa fon `inert` bo'lib qotardi.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia(SHELL_DESKTOP_QUERY);
    const onChange = () => {
      if (query.matches) closeMenu();
    };
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, [closeMenu]);

  return (
    <div className="flex h-dvh overflow-hidden bg-bg font-sans text-text [--shell-bottomnav-h:calc(4rem+env(safe-area-inset-bottom))]">
      <div data-shell-slot="sidebar" className="hidden h-full shrink-0 lg:flex">
        <Sidebar />
      </div>

      {/* Asosiy ustun — telefon menyusi ochiq bo'lsa `inert`: Tab va skrinrider menyudan tashqariga chiqmaydi. */}
      <div
        inert={isMenuOpen}
        data-shell-slot="column"
        className="relative flex min-w-0 flex-1 flex-col max-md:pb-[var(--shell-bottomnav-h)]"
      >
        <RouteProgress />

        <div data-shell-slot="topbar" className="relative z-40 shrink-0">
          <Header onMenuClick={openMenu} />
        </div>

        <div ref={setShellBannerSlot} data-shell-slot="banner" className="shrink-0" />

        <main ref={scrollRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
          <div
            data-shell-slot="content"
            className="mx-auto w-full max-w-[1440px] flex-1 px-8 pt-6 pb-12 max-lg:px-4 max-lg:pt-4 max-lg:pb-[88px]"
          >
            <Suspense fallback={<RouteSuspenseFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      <div inert={isMenuOpen} data-shell-slot="bottomnav" className="md:hidden">
        <BottomNav />
      </div>

      <MobileMenu isOpen={isMenuOpen} onClose={closeMenu} />

      <ScannerHost />
    </div>
  );
};

export default memo(DashboardLayout);
