/** «Olingan to'lovlar» bo'limi sarlavhasining `id` si (maket `#stl-pays`). */
export const REMITTANCES_SECTION_ID = "stl-pays";

/** Sarlavha ustida qoladigan bo'shliq (px) — `scroll-mt-4`. */
const ANCHOR_GAP_PX = 16;

/**
 * «Qarz yozuvlari» dagi «To'lov №N» — bo'limga o'tish (maket `href="#stl-pays"`). URL hash'i o'zgartirilmaydi (panel
 * holati `?t=` da); sarlavha o'rami fokus oladi — klaviatura va ekran o'quvchi ham shu yerga keladi.
 *
 * ⚠️ `scrollIntoView` EMAS: u `<main>` dan tashqari qobiqning `overflow-hidden` ildizini (`h-dvh`) ham 64 px suradi —
 * topbar ekrandan chiqib ketadi va qaytarib bo'lmaydi. Faqat qobiqning aylantiriladigan konteyneri (`<main>`) suriladi
 * (`scrollShellContentToTop` bilan bir xil yondashuv).
 */
export const focusRemittancesSection = () => {
  const head = document.querySelector<HTMLElement>("[data-remittances-head]");
  if (!head) return;
  const scroller = head.closest<HTMLElement>("main");
  if (scroller) {
    const top = scroller.scrollTop + head.getBoundingClientRect().top - scroller.getBoundingClientRect().top - ANCHOR_GAP_PX;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (typeof scroller.scrollTo === "function") scroller.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
    else scroller.scrollTop = Math.max(0, top);
  }
  head.focus({ preventScroll: true });
};
