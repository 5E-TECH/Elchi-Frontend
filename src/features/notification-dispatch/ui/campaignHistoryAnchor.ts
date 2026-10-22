/** «Kampaniyalar tarixi» kartasining `id` si (natija kartasidagi tugma va tasdiq matni shunga olib boradi). */
export const CAMPAIGN_HISTORY_ID = "campaign-history";

/**
 * Tarix kartasiga o'tish: shell'ning `<main>` skroll qiladi (`scrollIntoView` qobiq ildizini ham surardi — IS-3 dagi
 * tajriba), so'ng fokus karta sarlavhasiga (ekran o'quvchi va klaviatura uchun).
 */
export const scrollToCampaignHistory = () => {
  const card = document.getElementById(CAMPAIGN_HISTORY_ID);
  if (!card) return;
  const main = card.closest("main");
  if (main) {
    const top = card.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop - 16;
    main.scrollTo?.({ top, behavior: "smooth" });
  }
  card.focus({ preventScroll: true });
};
