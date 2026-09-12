/**
 * Integratsiyalar uyining tab ma'lumotlari — JSX'siz, sof ma'lumot.
 *
 * Alohida fayl, chunki testlar shu ro'yxatni React komponentini (va uning
 * lazy importlarini) tortmasdan o'qiy olishi kerak.
 */

/** Integratsiyaning YO'NALISHI — foydalanuvchi uchun eng muhim ajratim. */
export type IntegrationDirection = 'inbound' | 'outbound' | 'both';

export interface IntegrationTabMeta {
  key: string;
  /** URL segmenti (`/integrations/<path>`). */
  path: string;
  label: string;
  /** Bir qatorlik izoh — tab ostida ko'rsatiladi. */
  hint: string;
  direction: IntegrationDirection;
  /**
   * Uy qurilgunga qadar mavjud bo'lgan marshrut. SAQLANADI (redirect bilan) —
   * eski havola, xatcho'p yoki tashqi hujjatdagi manzil buzilmasin.
   */
  legacyPath: string;
}

/**
 * NEGA BU TARTIB. Birinchi tab — bizga ULANADIGANLAR (marketplace, do'kon),
 * chunki platformaning asosiy o'sish yo'nalishi shu. Keyin biz ULANADIGANLAR,
 * oxirida kunlik operatsion ish (kiruvchi posilkalarni qabul qilish).
 */
export const INTEGRATION_TABS: IntegrationTabMeta[] = [
  {
    key: 'partners',
    path: 'partners',
    label: 'Hamkorlar (API)',
    hint: "Bizga API orqali buyurtma yuboradigan tizimlar — marketplace, do'kon, CRM",
    direction: 'inbound',
    legacyPath: '/partners',
  },
  {
    key: 'sources',
    path: 'sources',
    label: 'Manbalar',
    hint: "Biz o'zimiz ulanadigan tashqi tizimlar — buyurtma tortib olish va status yuborish",
    direction: 'outbound',
    legacyPath: '/new-orders/integrations',
  },
  {
    key: 'incoming',
    path: 'incoming',
    label: 'Kiruvchi posilkalar',
    hint: 'Hamkordan kelgan posilkalarni skanerlab qabul qilish',
    direction: 'inbound',
    legacyPath: '/new-orders/integrations/incoming',
  },
];

/** `/integrations` ochilganda qaysi tabga o'tiladi. */
export const DEFAULT_INTEGRATION_TAB = INTEGRATION_TABS[0];
