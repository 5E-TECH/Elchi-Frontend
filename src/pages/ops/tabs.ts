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
   * `/system-ops` (`routes.tsx`) `/ops?tab=<key>` ga yo'naltiradi. Markaz ichida tug'ilgan tabda (masalan «Xarajat
   * kategoriyalari») yo'q — uning yagona manzili `/ops?tab=<key>`.
   */
  legacyPath?: string;
  /** `src/pages/` ichidagi papka nomi. */
  pageDir: string;
}

/** «Xarajat kategoriyalari» tabi kaliti — `/ops?tab=expense-categories` («Kassadan xarajat» havolasi ham shu). */
export const EXPENSE_CATEGORIES_TAB = "expense-categories";

/**
 * «Kassa smenasi» tabi kaliti — `/ops?tab=shift-settings` (ega 2026-11-16): kartalar qoldig'ini tasdiqlash, chek rasmi
 * va AI, smena hisobotini yuborish, to'lovlarni tuzatish muddati. Eski `/payments/shift-settings` shu tabga yo'naltiradi;
 * smena yopish oynasi, smena hisoboti, chek maydoni va tarix tafsilotidagi havolalar ham shu yerga olib keladi.
 */
export const SHIFT_SETTINGS_TAB = "shift-settings";

/**
 * «Kun tartibi» tabi kaliti — `/ops?tab=daily-schedule`: buyurtma yaratish va qabul qilish chegaralari, kun almashishi,
 * smenaning avtomatik ochilishi / yopilishi va kechikish xabari («Qabul va yaratish» sarlavhasidagi holat va smena
 * sozlamalaridagi havola ham shu tabga olib keladi).
 */
export const DAILY_SCHEDULE_TAB = "daily-schedule";

export const OPS_TABS: OpsTabMeta[] = [
  {
    /**
     * Kassa xarajati kategoriyalari (Elchi Pochta №1) — ilgari «Asosiy kassa» sarlavhasidagi tugmadan ochiladigan
     * oyna edi; sozlama sifatida Ops vositalariga ko'chirildi (moliya guruhi — birinchi tab; F2qp6FtE gacha
     * «Moliya operatorlari» dan keyin edi). To'g'ridan-to'g'ri eski yo'li yo'q. «Kassadan xarajat» oynasidagi havola
     * shu tabga olib keladi.
     */
    key: EXPENSE_CATEGORIES_TAB,
    labelKey: "tabs.expenseCategories",
    pageDir: "expense-categories",
  },
  {
    /**
     * Kassa smenasi sozlamalari (ega 2026-11-16: «ops vositalarida bo'lishi kerak, alohida tab sifatida») — ilgari
     * «To'lovlar» ostidagi alohida sahifa (`/payments/shift-settings`, «← Asosiy kassa») edi; moliya guruhida,
     * «Xarajat kategoriyalari» dan keyin. `legacyPath` yo'q: eski yo'l `pages/<pageDir>` naqshiga tushmaydi
     * (`/payments/shift-settings` ≠ `/payments/shiftSettings`) — yo'naltirish `routes.tsx` da.
     */
    key: SHIFT_SETTINGS_TAB,
    labelKey: "tabs.shiftSettings",
    pageDir: "payments/shiftSettings",
  },
  {
    /**
     * Kun tartibi (ega 2026-11-10): ilgari «Qabul va yaratish» sarlavhasidagi «Bugungi qabul vaqti» oynasi (yaratish
     * chegarasi, kun almashishi) va «Smena sozlamalari»dagi «Avtomatik yopish» — endi bitta joyda, qabul qilish
     * chegarasi, avtomatik ochish va kechikish xabari bilan. Hub ichida tug'ilgan — eski yo'li yo'q.
     */
    key: DAILY_SCHEDULE_TAB,
    labelKey: "tabs.dailySchedule",
    pageDir: "daily-schedule",
  },
  {
    key: "system",
    labelKey: "tabs.system",
    legacyPath: "/system-ops",
    pageDir: "system-ops",
  },
];

/**
 * «Moliya operatorlari» (`/finance-operators`, `?tab=finance`) olib tashlandi — F2qp6FtE (ega qarori 2026-11-16):
 * market o'z operatoriga O'ZI to'laydi va buni «Operatorlar → To'lovlar» da yozadi; superadmin endi operatorga Elchi
 * kassasidan to'lamaydi. Eski havola superadminni «Foydalanuvchilar → Market operatorlari» ga olib boradi (operatorlar
 * ro'yxati — o'qish uchun eng yaqin sahifa); operator hisobi — operator tafsilotidagi «Hisob» (B1te60bD, faqat ko'rish).
 */
export const FINANCE_OPERATORS_MOVED_TO = "/all-users?role=market_operator";

/**
 * Hub'dan ko'chgan tablar: filiallar vositasi ish sahifasi ichida, faqat superadmin ko'radi (F2NzXpMv); integratsiya
 * vositalari — konsol panellarida: qarzlar «Hisob-kitob», navbat «Ish rejimi» (Dj70iDbD); logistika (qaytarish
 * so'rovlari) — «Pochta → Qaytarish» (u5HTJtqK: `/returns` dagi superadmin nusxasi olib tashlandi, tasdiqlash va rad
 * etish o'sha tabda, tasdiq oynasi bilan). Eski `/ops?tab=<key>` havolasi yangi joyga o'tadi.
 *
 * Olib tashlangan tablar (LIuf0DcD, ega 2026-11-16; «Investorlar» — ega 2026-11-18) — eski havola o'rnini bosuvchi
 * sahifaga olib boradi:
 *  - «Kirish diagnostikasi» (`auth`, `POST /auth/refresh` sinov tugmasi) — haqiqiy jurnal «Faoliyat jurnali»;
 *  - «Xodimlar» (`identity`, adminlar / menejerlar / ro'yxatchilar ro'yxati, faqat o'qish) — «Foydalanuvchilar» rol
 *    tablari (nofaol qilish, parol SMS'i ham o'sha yerda);
 *  - «Investorlar» (`investors`, eski forma investorni LOGINSIZ yaratardi) — «Foydalanuvchilar → Investorlar»
 *    (`?role=investor`; yaratish — «Foydalanuvchi qo'shish» → «Investor», faqat superadmin);
 *  - «Yetkazish narxi» (`delivery-pricing`) — «Hududlar → Yetkazish tariflari» (`/delivery-tariffs`, mazmuni AYNI edi).
 */
export const MOVED_OPS_TABS: Readonly<Record<string, string>> = {
  logistics: "/mails/return",
  branches: "/batches",
  integrations: "/integrations",
  auth: "/activity-logs",
  identity: "/all-users",
  investors: "/all-users?role=investor",
  "delivery-pricing": "/delivery-tariffs",
  finance: FINANCE_OPERATORS_MOVED_TO,
};

/** Tab kaliti bo'yicha meta (to'g'ridan-to'g'ri yo'llardagi «← Ops vositalari» havolasi uchun). */
export const getOpsTab = (key: string): OpsTabMeta => OPS_TABS.find((tab) => tab.key === key) ?? OPS_TABS[0];

/** `/ops?tab=<key>` — hub'dagi shu tab. */
export const opsTabPath = (key: string) => `/ops?tab=${key}`;
