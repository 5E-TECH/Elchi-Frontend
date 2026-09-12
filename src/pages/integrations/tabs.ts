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
    /**
     * ⚠️ NOM TUZATILDI. Avval "Manbalar" deb nomlangan edi, lekin bu XATO:
     * `external_integrations` yozuvlari aslida YETKAZUVCHI naqshida ishlaydi
     * (`dispatch_config` bilan posilka yaratamiz, `ProviderReceivable` bilan
     * ularning COD qarzini yuritamiz). Ya'ni ular bizga buyurtma bermaydi —
     * bizdan posilka oladi.
     *
     * Endi tab rol-neytral nomlanadi va ICHIDA rol guruhlari bor
     * (yetkazuvchi / manba / to'lov / ko'zgu), chunki bitta ro'yxatda har
     * xil rol bo'lishi mumkin.
     */
    label: 'Tashqi tizimlar',
    hint: "Biz ulanadigan tizimlar — yetkazuvchi, manba, to'lov, ko'zgu",
    direction: 'both',
    legacyPath: '/new-orders/integrations',
  },
];

/** `/integrations` ochilganda qaysi tabga o'tiladi. */
export const DEFAULT_INTEGRATION_TAB = INTEGRATION_TABS[0];
