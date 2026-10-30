/**
 * Ops markazining tab ma'lumotlari — JSX'siz, sof ma'lumot.
 *
 * Alohida fayl, chunki testlar shu ro'yxatni React komponentini (va uning
 * lazy importlarini) tortmasdan o'qiy olishi kerak.
 */
export interface OpsTabMeta {
  key: string;
  /** Tab nomi — `ops` namespace kaliti (`ops:tabs.<key>`). */
  labelKey: string;
  /**
   * Markaz qo'shilgunga qadar mavjud bo'lgan to'g'ridan-to'g'ri marshrut — eski havola yoki xatcho'p buzilmaydi:
   * `/finance-operators`, `/integrations-ops`, `/identity-ops` o'z sarlavhasi bilan chiziladi, qolganlari
   * (`routes.tsx`) `/ops?tab=<key>` ga yo'naltiradi. Markaz ichida tug'ilgan tabda (masalan «Xarajat
   * kategoriyalari») yo'q — uning yagona manzili `/ops?tab=<key>`.
   */
  legacyPath?: string;
  /** `src/pages/` ichidagi papka nomi. */
  pageDir: string;
}

/** «Xarajat kategoriyalari» tabi kaliti — `/ops?tab=expense-categories` («Kassadan xarajat» havolasi ham shu). */
export const EXPENSE_CATEGORIES_TAB = "expense-categories";

/** «Yetkazish narxi» tabi kaliti — `/ops?tab=delivery-pricing` (tariflar, hisob qoidalari, hajm chegarasi). */
export const DELIVERY_PRICING_TAB = "delivery-pricing";

export const OPS_TABS: OpsTabMeta[] = [
  {
    key: "finance",
    labelKey: "tabs.finance",
    legacyPath: "/finance-operators",
    pageDir: "finance-operators",
  },
  {
    /**
     * Kassa xarajati kategoriyalari (Elchi Pochta №1) — ilgari «Asosiy kassa» sarlavhasidagi tugmadan ochiladigan
     * oyna edi; sozlama sifatida Ops vositalariga ko'chirildi (moliya guruhi, «Moliya operatorlari» dan keyin).
     * To'g'ridan-to'g'ri eski yo'li yo'q. «Kassadan xarajat» oynasidagi havola shu tabga olib keladi.
     */
    key: EXPENSE_CATEGORIES_TAB,
    labelKey: "tabs.expenseCategories",
    pageDir: "expense-categories",
  },
  {
    key: "integrations",
    labelKey: "tabs.integrations",
    legacyPath: "/integrations-ops",
    pageDir: "integrations-ops",
  },
  {
    key: "investors",
    labelKey: "tabs.investors",
    legacyPath: "/investors-ops",
    pageDir: "investors-ops",
  },
  {
    key: "logistics",
    labelKey: "tabs.logistics",
    legacyPath: "/logistics-ops",
    pageDir: "logistics-ops",
  },
  {
    /**
     * Yetkazish narxi (ega 2026-10-25): tariflar, hisob qoidalari — «Hajm bo'yicha hisoblash chegarasi»
     * (`volumetric_from_kg`) ham, kalkulyator, tarix. Mazmuni `/delivery-tariffs` bilan AYNI (`DeliveryTariffsContent`).
     * `legacyPath` yo'q: `/delivery-tariffs` eski ops manzili emas — «Hududlar» bo'limining o'z sahifasi (admin ham,
     * «← Hududlar»), hub esa uni `embedded` bilan chizadi.
     */
    key: DELIVERY_PRICING_TAB,
    labelKey: "tabs.deliveryPricing",
    pageDir: "delivery-tariffs",
  },
  {
    key: "branches",
    labelKey: "tabs.branches",
    legacyPath: "/branch-ops",
    pageDir: "branch-ops",
  },
  {
    key: "identity",
    labelKey: "tabs.identity",
    legacyPath: "/identity-ops",
    pageDir: "identity-ops",
  },
  {
    key: "system",
    labelKey: "tabs.system",
    legacyPath: "/system-ops",
    pageDir: "system-ops",
  },
  {
    /**
     * ⚠️ ILGARI MENYUDA "Loglar" DEB TURGAN SAHIFA — lekin u jurnal EMAS.
     *
     * Ichida `POST /auth/refresh` ga sinov so'rovi yuboradigan bitta tugma
     * bor. Ya'ni nomi bilan mazmuni bir-biriga mos kelmasdi: biror hodisani
     * tekshirmoqchi bo'lgan operator "Loglar"ni bosib, token yangilash
     * tugmasini ko'rardi va haqiqiy jurnalni (`/activity-logs`) topolmasdi.
     *
     * Bu DIAGNOSTIKA vositasi — o'rni Ops markazi. Menyudan olib tashlandi,
     * eski marshrut (`/logs`) shu tabga yo'naltiradi (bhitm9do). Dizayn v2 da
     * yorlig'i — «Kirish diagnostikasi» (maket `superadmin-ops-auth-diagnostics`).
     */
    key: "auth",
    labelKey: "tabs.auth",
    legacyPath: "/logs",
    pageDir: "logs",
  },
];

/** Tab kaliti bo'yicha meta (to'g'ridan-to'g'ri yo'llardagi «← Ops vositalari» havolasi uchun). */
export const getOpsTab = (key: string): OpsTabMeta => OPS_TABS.find((tab) => tab.key === key) ?? OPS_TABS[0];

/** `/ops?tab=<key>` — hub'dagi shu tab. */
export const opsTabPath = (key: string) => `/ops?tab=${key}`;
