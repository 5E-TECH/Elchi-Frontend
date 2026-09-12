import type { IntegrationCategory, IntegrationRole } from '../../entities/integrations';

/**
 * ULANISH REGISTRI — barcha tashqi tizim bitta ro'yxatda.
 *
 * NEGA REGISTR (PCS'dagi `DELIVERY_PROVIDERS` naqshi). Ilgari Elchi'da
 * integratsiya IKKI xil sahifada boshqarilardi:
 *
 *   "Hamkorlar (API)"  — bizga ulanadiganlar (`partners` jadvali)
 *   "Tashqi tizimlar"  — biz ulanadiganlar (`external_integrations`)
 *
 * Foydalanuvchi uchun ular BITTA ish: "tashqi tizim bilan ulanishni sozlash".
 * Ikki sahifa, ikki xil forma, ikki xil terminologiya — tartibsizlik. Endi
 * bitta yuza: ulanish tanlanadi, keyin uning paneli ochiladi.
 *
 * ⚠️ HALOL CHEGARA. Registr UI'ni birlashtiradi, BACKENDNI EMAS: `partners`
 * va `external_integrations` hamon alohida jadvallar va alohida endpointlar.
 * Ularni birlashtirish alohida, kattaroq ish — va u UI tartibsizligini hal
 * qilmaydi, shuning uchun avval UI.
 */

/**
 * Ulanish qaysi BACKEND yozuviga tegishli.
 *
 * Bu foydalanuvchiga ko'rsatilmaydi — u faqat "ulanish" ko'radi. Lekin forma
 * qaysi endpointga borishini shu belgilaydi.
 */
export type ConnectionKind = 'partner' | 'integration';

/** Forma maydonining turi — UI qanday nazorat chizishini belgilaydi. */
export type FieldType = 'text' | 'url' | 'secret' | 'select' | 'switch' | 'tags';

export interface ConnectionField {
  key: string;
  label: string;
  type: FieldType;
  /** Bir qatorlik izoh — maydon ostida chiqadi. */
  hint?: string;
  placeholder?: string;
  /** `select` uchun variantlar. */
  options?: Array<{ value: string; label: string }>;
  /**
   * Sir maydoni: qiymati HECH QACHON serverdan qaytmaydi (faqat
   * shifrlangan holda saqlanadi). Bo'sh qoldirilsa tegilmaydi.
   */
  writeOnly?: boolean;
}

export interface ConnectionTypeMeta {
  /** Registr kaliti — "yangi ulanish" oynasida shu tanlanadi. */
  key: string;
  label: string;
  /** Tanlash kartasidagi bir qatorlik tavsif. */
  desc: string;
  kind: ConnectionKind;
  role: IntegrationRole;
  category: IntegrationCategory;
  /**
   * Ulanish uchun so'raladigan maydonlar.
   *
   * Foydalanuvchi talabi: "deyarli bir xil UI, faqat so'raydigan va
   * ulaydigan qiymatlari farqli bo'lsa faqat shular boshqa bo'lsin".
   * Shu bois FORMA UMUMIY komponent, bu yerda faqat MAYDONLAR ro'yxati.
   */
  fields: ConnectionField[];
}

/** Har turda takrorlanadigan maydonlar — bir joyda. */
const NAME_FIELD: ConnectionField = {
  key: 'name',
  label: 'Nomi',
  type: 'text',
  placeholder: 'Uzum Market',
  hint: 'Operator ro‘yxatda shu nomni ko‘radi',
};

const ACTIVE_FIELD: ConnectionField = {
  key: 'is_active',
  label: 'Faol',
  type: 'switch',
  hint: 'O‘chirilsa ulanish umuman ishlamaydi (kill-switch)',
};

/** Bizga ULANADIGANLAR uchun (inbound) — API kalit bizdan chiqadi. */
const INBOUND_FIELDS: ConnectionField[] = [
  NAME_FIELD,
  {
    key: 'webhook_url',
    label: 'Webhook manzili',
    type: 'url',
    placeholder: 'https://partner.example.com/elchi/webhook',
    hint: 'Status o‘zgarganda biz SHU manzilga POST qilamiz',
  },
  {
    key: 'webhook_secret',
    label: 'Webhook sekreti',
    type: 'secret',
    writeOnly: true,
    hint: 'HMAC-SHA256 imzo kaliti. Bo‘sh qoldirilsa tegilmaydi',
  },
  {
    key: 'sandbox_webhook_url',
    label: 'Sandbox manzili',
    type: 'url',
    placeholder: 'https://dev.partner.example.com/elchi/webhook',
    hint: 'Har hodisaning NUSXASI shu yerga ham ketadi. Xatosi asosiy yetkazishga ta’sir qilmaydi',
  },
  {
    key: 'sandbox_webhook_secret',
    label: 'Sandbox sekreti',
    type: 'secret',
    writeOnly: true,
    hint: 'Berilmasa asosiy sekret ishlatiladi',
  },
  {
    key: 'ip_allowlist',
    label: 'Ruxsat etilgan IP',
    type: 'tags',
    placeholder: '203.0.113.10 yoki 203.0.113.0/24',
    hint: 'Bo‘sh bo‘lsa cheklov yo‘q. CIDR qo‘llab-quvvatlanadi',
  },
  ACTIVE_FIELD,
];

/** BIZ ULANADIGANLAR uchun (outbound) — kalit ularda. */
const OUTBOUND_FIELDS: ConnectionField[] = [
  NAME_FIELD,
  {
    key: 'slug',
    label: 'Slug',
    type: 'text',
    placeholder: 'uzum',
    hint: 'Texnik nom — kodda va loglarda ishlatiladi. O‘zgartirilmasligi yaxshi',
  },
  {
    key: 'base_url',
    label: 'API manzili',
    type: 'url',
    placeholder: 'https://api.uzum.uz',
    hint: 'Biz so‘rovlarni shu manzilga yuboramiz',
  },
  {
    key: 'auth_type',
    label: 'Autentifikatsiya',
    type: 'select',
    options: [
      { value: 'bearer', label: 'Bearer token' },
      { value: 'basic', label: 'Login + parol' },
      { value: 'none', label: 'Yo‘q' },
    ],
  },
  {
    key: 'token',
    label: 'Token',
    type: 'secret',
    writeOnly: true,
    hint: 'Bearer rejimida. Bo‘sh qoldirilsa tegilmaydi',
  },
  {
    key: 'username',
    label: 'Login',
    type: 'text',
    hint: 'Basic rejimida',
  },
  {
    key: 'password',
    label: 'Parol',
    type: 'secret',
    writeOnly: true,
    hint: 'Basic rejimida. Bo‘sh qoldirilsa tegilmaydi',
  },
  ACTIVE_FIELD,
];

/**
 * ULANISH TURLARI.
 *
 * Yangi tizim qo'shish = shu massivga BITTA yozuv. Forma, ro'yxat va panel
 * umumiy — ular maydon ro'yxatidan o'zini yasaydi.
 */
export const CONNECTION_TYPES: ConnectionTypeMeta[] = [
  {
    key: 'marketplace_inbound',
    label: 'Marketplace (bizga ulanadi)',
    desc: 'Uzum, Olcha va h.k. — bizning API orqali buyurtma yuboradi',
    kind: 'partner',
    role: 'source',
    category: 'marketplace',
    fields: INBOUND_FIELDS,
  },
  {
    key: 'marketplace_outbound',
    label: 'Marketplace (biz ulanadmiz)',
    desc: 'Buyurtmani biz tortib olamiz — ularning API’siga moslashamiz',
    kind: 'integration',
    role: 'source',
    category: 'marketplace',
    fields: OUTBOUND_FIELDS,
  },
  {
    key: 'crm',
    label: 'CRM',
    desc: 'Bitrix24, amoCRM — voronkadan buyurtma',
    kind: 'integration',
    role: 'source',
    category: 'crm',
    fields: OUTBOUND_FIELDS,
  },
  {
    key: 'carrier',
    label: 'Yetkazuvchi',
    desc: 'Bizdan posilka oladi va yetkazadi. COD puli ular orqali qaytadi',
    kind: 'integration',
    role: 'carrier',
    category: 'cargo',
    fields: OUTBOUND_FIELDS,
  },
  {
    key: 'payment',
    label: 'To‘lov tizimi',
    desc: 'Payme, Click, bank — to‘lov holatini tasdiqlaydi',
    kind: 'integration',
    role: 'payment',
    category: 'payment',
    fields: OUTBOUND_FIELDS,
  },
  {
    key: 'mirror',
    label: 'Ko‘zgu (eksport)',
    desc: 'Sheets, BI — faqat o‘qish uchun. Hech narsani o‘zgartirmaydi',
    kind: 'integration',
    role: 'mirror',
    category: 'spreadsheet',
    fields: OUTBOUND_FIELDS,
  },
];

/** Rol bo'yicha guruhlash tartibi — ro'yxatda shu ketma-ketlikda chiqadi. */
export const ROLE_ORDER: IntegrationRole[] = [
  'source',
  'carrier',
  'payment',
  'mirror',
];

export const findConnectionType = (key: string): ConnectionTypeMeta | undefined =>
  CONNECTION_TYPES.find((t) => t.key === key);
