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
/**
 * ⚠️ "Kiruvchi posilkalar" tabi BU YERDAN OLIB TASHLANDI va
 * `/new-orders/incoming` ga ko'chirildi.
 *
 * Sabab: posilkalarni skanerlab qabul qilish — KUNLIK OPERATSIYA, sozlama
 * emas. Integratsiyalar sahifasi faqat ulanishlarni sozlash uchun qoladi.
 * Eski yo'l redirect bilan saqlanadi.
 */
/**
 * ⚠️ TABLAR ENDI "ESKI YUZALAR" — asosiy ish `/integrations` ildizida.
 *
 * Ilgari bu yerda uch tab bor edi: "Hamkorlar (API)", "Tashqi tizimlar",
 * "Kiruvchi posilkalar". Muammolar:
 *
 *   1. Kiruvchi posilkalar — KUNLIK OPERATSIYA, sozlama emas. U
 *      `/new-orders/incoming` ga ko'chirildi.
 *   2. "Hamkorlar" va "Tashqi tizimlar" — foydalanuvchi uchun BITTA ish
 *      ("tashqi tizim bilan ulanishni sozlash"), lekin ikki forma, ikki
 *      terminologiya. Endi ular yagona `ConnectionsPage` da birlashdi.
 *
 * Eski sahifalar SAQLANADI: yangisi to'liq ishlagani tasdiqlanmaguncha ular
 * zaxira. Operator biror narsani yangi yuzadan qilolmasa, eski manzil orqali
 * ishlay oladi. Shu bois tablar butunlay o'chirilmadi — ular "eski yuza"
 * sifatida ko'rinadi.
 */
export const INTEGRATION_TABS: IntegrationTabMeta[] = [
  {
    key: 'partners',
    path: 'partners',
    label: 'Eski: Hamkorlar',
    hint: "Zaxira yuza — asosiy ish yuqorida, ulanishlar ro'yxatida",
    direction: 'inbound',
    legacyPath: '/partners',
  },
  {
    key: 'sources',
    path: 'sources',
    label: 'Eski: Tashqi tizimlar',
    hint: 'Zaxira yuza — yangi ulanish qo‘shish hozircha shu yerda',
    direction: 'both',
    legacyPath: '/new-orders/integrations',
  },
];

/** `/integrations` ochilganda qaysi tabga o'tiladi. */
export const DEFAULT_INTEGRATION_TAB = INTEGRATION_TABS[0];
