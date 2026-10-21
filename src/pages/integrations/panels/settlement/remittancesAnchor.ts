/** «Olingan to'lovlar» bo'limi sarlavhasining `id` si (maket `#stl-pays`). */
export const REMITTANCES_SECTION_ID = "stl-pays";

/**
 * «Qarz yozuvlari» dagi «To'lov №N» — bo'limga o'tish (maket `href="#stl-pays"`). URL hash'i o'zgartirilmaydi (panel
 * holati `?t=` da); sarlavha o'rami fokus oladi — klaviatura va ekran o'quvchi ham shu yerga keladi.
 */
export const focusRemittancesSection = () => {
  const head = document.querySelector<HTMLElement>("[data-remittances-head]");
  if (!head) return;
  head.scrollIntoView?.({ behavior: "smooth", block: "start" });
  head.focus({ preventScroll: true });
};
