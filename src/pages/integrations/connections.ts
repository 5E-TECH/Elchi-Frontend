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
  /**
   * Maydon qaysi tabda chiziladi.
   *
   *   `connection` (sukut) — "qanday ishlaydi": manzil, nom, kirish turi.
   *   `security`           — "kim tegishi mumkin": kirishni CHEKLAYDIGAN
   *                          qiymatlar. Bu yerdagi xato ulanishni butunlay
   *                          to'sib qo'yishi mumkin, shuning uchun alohida.
   *
   * Registr YAGONA qoladi — ikki panel bitta ro'yxatdan o'zini yasaydi.
   */
  group?: 'connection' | 'security';
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
  /**
   * ULANISHDAN OLDIN nima tayyor bo'lishi kerak.
   *
   * Nega registrda: katalog kartasida ham, ustaning 1-qadamida ham AYNI
   * ro'yxat ko'rsatiladi. Operator ustaga kirib, keyin "menda bu yo'q" deb
   * chiqib ketishi — eng ko'p uchraydigan to'xtash nuqtasi. Ro'yxatni
   * OLDIN ko'rsatish shuni oldini oladi.
   */
  prereqs: string[];
}

/** Har turda takrorlanadigan maydonlar — bir joyda. */
const NAME_FIELD: ConnectionField = {
  key: 'name',
  label: 'Nomi',
  type: 'text',
  placeholder: 'Uzum Market',
  hint: 'Operator ro‘yxatda shu nomni ko‘radi',
};

/*
 * `is_active` ATAYLAB registrda YO'Q.
 *
 * ⚠️ U ilgari oddiy `switch` maydoni edi va Sozlamalar formasi bilan birga
 * saqlanardi. HAMKOR uchun bu JIMGINA ISHLAMASDI: gateway'da
 * `whitelist: true`, `UpdatePartnerRequestDto` esa `is_active` maydonini
 * e'lon qilmaydi — ya'ni qiymat yo'lda tashlanardi, forma esa "Saqlandi"
 * deb yozardi. Foydalanuvchi ulanishni o'chirdim deb o'ylab, u ishlab
 * turardi.
 *
 * Hamkor uchun alohida endpoint bor (`POST partners/:id/status`),
 * integratsiya uchun esa PATCH'da `is_active` mavjud. Ikki xil yo'l — shu
 * bois bu umumiy formaga sig'maydi va Xavfsizlik panelida ALOHIDA amal
 * bo'lib chiqadi (ta'siri katta amal, tasdiq bilan).
 */

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
    group: 'security',
  },
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
    /**
     * ⚠️ ROL FORMADA BO'LISHI SHART.
     *
     * Ilgari u yo'q edi va buni foydalanuvchi topdi: "Donoxon nega
     * yetkazuvchi kargo sifatida belgilangan? U ham sayt va undan ham
     * buyurtmalar keladi".
     *
     * Sabab — migratsiya: `role`/`category` ustunlari qo'shilganda MAVJUD
     * yozuvlarga sukut sifatida `carrier`/`cargo` yozilgan (o'sha paytdagi
     * ulanishlarning ko'pi haqiqatan tashuvchi edi). Lekin formada bu maydon
     * bo'lmagani uchun noto'g'ri tasniflangan ulanishni TUZATIB
     * BO'LMASDI — u abadiy "yetkazuvchi" bo'lib qolardi.
     *
     * ⚠️ Qiymatlar backend `@IsIn` ro'yxati bilan AYNAN bir xil bo'lishi
     * kerak, aks holda 400 qaytadi.
     */
    key: 'role',
    label: 'Roli',
    type: 'select',
    options: [
      { value: 'source', label: 'Buyurtma manbasi — bizga buyurtma beradi' },
      { value: 'carrier', label: 'Yetkazuvchi — bizdan posilka oladi' },
      { value: 'payment', label: "To'lov tizimi" },
      { value: 'mirror', label: "Ko'zgu — faqat eksport" },
    ],
    hint: 'Ulanish nima qiladi. Ro‘yxatdagi rangi va guruhi shunga bog‘liq',
  },
  {
    key: 'category',
    label: 'Turi',
    type: 'select',
    options: [
      { value: 'marketplace', label: 'Marketplace / sayt' },
      { value: 'crm', label: 'CRM' },
      { value: 'cargo', label: 'Kargo' },
      { value: 'payment', label: "To'lov" },
      { value: 'spreadsheet', label: 'Jadval / hisobot' },
      { value: 'other', label: 'Boshqa' },
    ],
    hint: 'Faqat tasnif uchun — xatti-harakatga ta’sir qilmaydi',
  },
  {
    key: 'base_url',
    label: 'API manzili',
    type: 'url',
    placeholder: 'https://api.uzum.uz',
    hint: 'Biz so‘rovlarni shu manzilga yuboramiz',
  },
  {
    /**
     * ⚠️ Variantlar BACKEND bilan bir xil bo'lishi SHART. Ilgari bu yerda
     * `bearer` / `basic` / `none` turardi — backend esa faqat `api_key` va
     * `login` ni biladi va boshqa hamma qiymatni `api_key` ga aylantiradi
     * (`integration-service.service.ts:3339`). Ya'ni "Yo'q" tanlansa ham
     * kalitli rejim yozilardi va sabab hech qayerda ko'rinmasdi.
     */
    key: 'auth_type',
    label: 'Kirish turi',
    type: 'select',
    options: [
      { value: 'api_key', label: 'API kalit' },
      { value: 'login', label: 'Login + parol' },
    ],
    hint: 'Ular bizni qanday taniydi',
  },
  {
    /**
     * ⚠️ Kalit `api_key` — `token` EMAS. Ilgari bu maydon `token` deb
     * atalgan edi va backend DTO'sida bunday maydon yo'q: `whitelist: true`
     * uni jimgina tashlab yuborardi, ya'ni kalit HECH QACHON saqlanmasdi.
     */
    key: 'api_key',
    label: 'API kalit',
    type: 'secret',
    writeOnly: true,
    hint: '"API kalit" rejimida. Bo‘sh qoldirilsa tegilmaydi',
    group: 'security',
  },
  {
    key: 'auth_url',
    label: 'Kirish manzili',
    type: 'url',
    placeholder: 'https://api.example.uz/auth/login',
    hint: '"Login + parol" rejimida — token shu manzildan olinadi',
  },
  {
    key: 'username',
    label: 'Login',
    type: 'text',
    hint: '"Login + parol" rejimida',
  },
  {
    key: 'password',
    label: 'Parol',
    type: 'secret',
    writeOnly: true,
    hint: '"Login + parol" rejimida. Bo‘sh qoldirilsa tegilmaydi',
    group: 'security',
  },
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
    prereqs: [
      'Ularning tomonida HTTPS webhook manzili (status shu yerga boradi)',
      'Imzoni tekshirish uchun kelishilgan sekret (ixtiyoriy, lekin tavsiya)',
      'Ularning so\u2019rov yuboradigan IP manzillari (ixtiyoriy cheklov)',
    ],
  },
  {
    key: 'marketplace_outbound',
    label: 'Marketplace (biz ulanadmiz)',
    desc: 'Buyurtmani biz tortib olamiz — ularning API’siga moslashamiz',
    kind: 'integration',
    role: 'source',
    category: 'marketplace',
    fields: OUTBOUND_FIELDS,
    prereqs: [
      'Ularning API manzili (HTTPS)',
      'API kalit yoki login+parol',
      'Qaysi buyurtmalarni tortib olishimiz kelishilgan bo\u2019lishi',
    ],
  },
  {
    key: 'crm',
    label: 'CRM',
    desc: 'Bitrix24, amoCRM — voronkadan buyurtma',
    kind: 'integration',
    role: 'source',
    category: 'crm',
    fields: OUTBOUND_FIELDS,
    prereqs: [
      'CRM API manzili (HTTPS)',
      'API kalit yoki login+parol',
      'Qaysi voronka/bosqichdan buyurtma olinishi',
    ],
  },
  {
    key: 'carrier',
    label: 'Yetkazuvchi',
    desc: 'Bizdan posilka oladi va yetkazadi. COD puli ular orqali qaytadi',
    kind: 'integration',
    role: 'carrier',
    category: 'cargo',
    fields: OUTBOUND_FIELDS,
    prereqs: [
      'Yetkazuvchining API manzili (HTTPS)',
      'API kalit',
      'Tarif va qaytarish shartlari kelishilgan bo\u2019lishi',
    ],
  },
  {
    key: 'payment',
    label: 'To‘lov tizimi',
    desc: 'Payme, Click, bank — to‘lov holatini tasdiqlaydi',
    kind: 'integration',
    role: 'payment',
    category: 'payment',
    fields: OUTBOUND_FIELDS,
    prereqs: [
      'To\u2019lov tizimining API manzili (HTTPS)',
      'Savdo nuqtasi (merchant) kaliti',
      'Qaysi to\u2019lov holati tasdiq deb qabul qilinishi',
    ],
  },
  {
    key: 'mirror',
    label: 'Ko‘zgu (eksport)',
    desc: 'Sheets, BI — faqat o‘qish uchun. Hech narsani o‘zgartirmaydi',
    kind: 'integration',
    role: 'mirror',
    category: 'spreadsheet',
    fields: OUTBOUND_FIELDS,
    prereqs: [
      'Eksport manzili (HTTPS)',
      'Yozish huquqi bo\u2019lgan kalit',
      'Qaysi maydonlar chiqarilishi',
    ],
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

/**
 * Guruh bo'yicha maydonlarni ajratadi.
 *
 * Guruhi belgilanmagan maydon `connection` deb hisoblanadi — ya'ni yangi
 * maydon qo'shganda uni unutib qoldirsak, u Sozlamalarda KO'RINADI. Teskari
 * sukut xavfli bo'lardi: maydon hech qaysi tabga tushmay, jimgina yo'qolib
 * ketardi.
 */
export const fieldsInGroup = (
  fields: ConnectionField[],
  group: 'connection' | 'security',
): ConnectionField[] =>
  fields.filter((f) => (f.group ?? 'connection') === group);
