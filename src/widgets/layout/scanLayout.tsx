// dizayn-v2: shell
import { memo } from "react";
import { Outlet } from "react-router-dom";
import RouteProgress from "./ui/RouteProgress";
import SkipLink, { MAIN_CONTENT_ID } from "./ui/SkipLink";

/**
 * Skaner sahifalari qobig'i (`/scan`, `/scan/:token`) — yon menyu va pastki menyusiz.
 * Fon `bg` (maket `.el-cam-screen`); kamera yuzasi o'z rangini o'zi beradi.
 *
 * - Chekkalar maket `.el-cam-screen` dagidek: ≥ 1024 — 24px 32px 32px, undan torda — 16px
 *   (telefondagi to'liq ekranli kamera — sahifaning o'z ishi, 4-bosqich). Breakpoint faqat `lg:`
 *   (`sm:` telefon chegarasi emas).
 * - Yuqori chiziq (`RouteProgress`, taxta `tizim-loading` 1): skanerdan natijaga (`/scan` → `/scan/:token`)
 *   o'tishda ham bo'lim kodi yuklanguncha 150 ms dan keyin ko'rinadi. Bu qobiqda oyna o'zi aylanadi,
 *   shuning uchun chiziq `fixed` qatlamda — skroll qilingan sahifada ham tepada.
 * - Birinchi fokuslanadigan element — «Asosiy kontentga o'tish» (`SkipLink`, KI-S2), nishoni — kontent bloki
 *   (`id="main-content"`, `tabIndex={-1}`).
 */
const ScanLayout = () => {
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-text">
      <SkipLink />
      <div className="fixed inset-x-0 top-0 z-50">
        <RouteProgress />
      </div>
      <main className="flex-1 overflow-y-auto px-4 py-4 lg:px-8 lg:pt-6 lg:pb-8">
        <div id={MAIN_CONTENT_ID} tabIndex={-1} className="mx-auto w-full max-w-[1440px] outline-none">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default memo(ScanLayout);
