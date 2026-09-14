import type { IntegrationCategory, IntegrationRole } from "../../entities/integrations";

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
export type ConnectionKind = "partner" | "integration";

/** Forma maydonining turi — UI qanday nazorat chizishini belgilaydi. */
export type FieldType =
  | "text"
  | "url"
  | "secret"
  | "select"
  | "switch"
  | "tags"
  /**
   * Elchi market akkaunti — ro'yxat API'dan yuklanadi.
   *
   * ⚠️ ALOHIDA TUR KERAK BO'LDI. `select` statik variantlar bilan ishlaydi,
   * market esa bazadan keladi va o'nlab bo'lishi mumkin. Matn maydoni ham
   * yaramaydi: operator bigint id'ni yodda saqlamaydi.
   */
  | "market"
  /**
   * Kalit→qiymat xaritasi (JSON). Tashqi saytning maydon nomlarini bizning
   * maydonlarimizga bog'laydi.
   */
  | "mapping";

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
  group?: "connection" | "security" | "sandbox";
  /**
   * Maydon FAQAT boshqa maydon ma'lum qiymatda bo'lganda ko'rinadi.
   *
   * ⚠️ NEGA KERAK. `auth_type` "API kalit" bo'lsa login/parol maydonlari
   * keraksiz, lekin ilgari TO'RTTASI BIRGA ko'rinardi (audit FE-07) va
   * operator qaysi ikkitasini to'ldirish kerakligini taxmin qilardi.
   */
  showWhen?: { key: string; equals: string | boolean };
  /**
   * Maydon KO'RINADI, lekin tahrirlanmaydi.
   *
   * ⚠️ `showWhen` DAN FARQI MUHIM. Yashirish ma'lumotni ham yashiradi:
   * sandbox kaliti o'chirilganda saqlangan manzil ko'rinmay qolardi va
   * operator nima sozlanganini BILMASDI — "o'chirdim, endi qayerga
   * yozilganini eslay olmayman" holati. O'chirilgan (disabled) maydon esa
   * qiymatni ko'rsatadi va tasodifan o'zgartirishga yo'l qo'ymaydi.
   */
  disabledWhen?: { key: string; equals: string | boolean };
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
  key: "name",
  label: "Nomi",
  type: "text",
  placeholder: "Uzum Market",
  hint: "Operator ro'yxatda shu nomni ko'radi",
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
    key: "webhook_url",
    label: "Webhook manzili",
    type: "url",
    placeholder: "https://partner.example.com/elchi/webhook",
    hint: "Status o'zgarganda biz SHU manzilga POST qilamiz",
  },
  {
    key: "webhook_secret",
    label: "Webhook sekreti",
    type: "secret",
    writeOnly: true,
    hint: "HMAC-SHA256 imzo kaliti. Bo'sh qoldirilsa tegilmaydi",
  },
  /**
   * ⚠️ SANDBOX MAYDONLARI ALOHIDA GURUHDA — prodakshn bilan YONMA-YON EMAS.
   *
   * Ilgari ular shu ro'yxatda, asosiy webhook maydonlarining ostida
   * turardi: "Webhook sekreti" va "Sandbox sekreti" — ikki AYNI
   * ko'rinishdagi parol maydoni yonma-yon. Foydalanuvchi shikoyati aynan
   * shu: "sandbox va real rejim bir biriga aralashib ketgan". Xato
   * maydonga prodakshn sekretini yozib qo'yish juda oson edi.
   *
   * Endi ular `sandbox` guruhida — Sozlamalar tabida ALOHIDA kartada
   * chiziladi va kalit o'chiq bo'lsa umuman ko'rinmaydi.
   */
  {
    key: "sandbox_enabled",
    label: "Sandbox rejimi",
    type: "switch",
    hint: "Yoqilsa, har hodisaning NUSXASI sinov manziliga ham ketadi",
    group: "sandbox",
  },
  {
    key: "sandbox_webhook_url",
    label: "Sandbox manzili",
    type: "url",
    placeholder: "https://dev.partner.example.com/elchi/webhook",
    hint: "Nusxa shu yerga ketadi. Xatosi asosiy yetkazishga ta'sir qilmaydi",
    group: "sandbox",
    disabledWhen: { key: "sandbox_enabled", equals: false },
  },
  {
    key: "sandbox_webhook_secret",
    label: "Sandbox sekreti",
    type: "secret",
    writeOnly: true,
    /**
     * ⚠️ HINT O'ZGARDI. Ilgari "Berilmasa asosiy sekret ishlatiladi" deb
     * yozilgan edi — va kod haqiqatan shunday qilardi, ya'ni PRODAKSHN
     * imzo kaliti dev hostga yuborilardi. Sinov muhitlari kamroq
     * himoyalangan; kalit oqsa u bilan HAQIQIY webhook imzolash mumkin
     * bo'lardi. Endi alohida sekret SHART.
     */
    hint: "ALOHIDA sekret shart — prodakshn sekreti sinov muhitiga yuborilmaydi",
    group: "sandbox",
    disabledWhen: { key: "sandbox_enabled", equals: false },
  },
  {
    key: "ip_allowlist",
    label: "Ruxsat etilgan IP",
    type: "tags",
    placeholder: "203.0.113.10 yoki 203.0.113.0/24",
    hint: "Bo'sh bo'lsa cheklov yo'q. CIDR qo'llab-quvvatlanadi",
    group: "security",
  },
];

/** BIZ ULANADIGANLAR uchun (outbound) — kalit ularda. */
/* ═══════════════════════════════════════════════════════════════════════
   UMUMIY BO'LAKLAR — har tur o'z ro'yxatini SHULARDAN yig'adi.

   ⚠️ ILGARI 6 TURDAN 5 TASI AYNI BITTA MASSIV OBYEKTINI ulashardi
   (`fields: OUTBOUND_FIELDS`). Natijada katalogda 6 karta ko'rinib, ichida
   hammasi bir xil forma chiqardi — foydalanuvchi shikoyatining
   to'g'ridan-to'g'ri sababi (audit FE-01).

   Endi har tur o'ziga KERAKLI bo'laklarni yig'adi. Umumiy bo'lak alohida
   massiv: bittasi o'zgarsa hammasida o'zgaradi, lekin TO'PLAM turga xos.
   ═══════════════════════════════════════════════════════════════════════ */

/** Texnik nom — barcha chiquvchi ulanishda. */
const SLUG_FIELD: ConnectionField = {
  key: "slug",
  label: "Slug",
  type: "text",
  placeholder: "donoxon",
  hint: "Texnik nom — kodda, loglarda va webhook manzilida ishlatiladi. O'zgartirilmasligi yaxshi",
};

/** Biz ularga so'rov yuboradigan manzil + kirish. */
const OUTBOUND_AUTH: ConnectionField[] = [
  {
    key: "base_url",
    label: "API manzili",
    type: "url",
    placeholder: "https://api.donoxon.uz",
    hint: "Biz so'rovlarni shu manzilga yuboramiz",
  },
  {
    key: "auth_type",
    label: "Kirish turi",
    type: "select",
    options: [
      { value: "api_key", label: "API kalit" },
      { value: "login", label: "Login + parol" },
    ],
    hint: "Ular bizni qanday taniydi",
  },
  {
    key: "api_key",
    label: "API kalit",
    type: "secret",
    writeOnly: true,
    hint: "Bo'sh qoldirilsa tegilmaydi",
    group: "security",
    showWhen: { key: "auth_type", equals: "api_key" },
  },
  {
    key: "auth_url",
    label: "Kirish manzili",
    type: "url",
    placeholder: "https://api.donoxon.uz/auth/login",
    hint: "Token shu manzildan olinadi",
    showWhen: { key: "auth_type", equals: "login" },
  },
  {
    key: "username",
    label: "Login",
    type: "text",
    showWhen: { key: "auth_type", equals: "login" },
  },
  {
    key: "password",
    label: "Parol",
    type: "secret",
    writeOnly: true,
    hint: "Bo'sh qoldirilsa tegilmaydi",
    group: "security",
    showWhen: { key: "auth_type", equals: "login" },
  },
];

/** Buyurtma KIRADIGAN ulanish uchun: qaysi market hisobiga yozilsin. */
const MARKET_FIELD: ConnectionField = {
  /**
   * ⚠️ IMPORT UCHUN MAJBURIY (audit EI-02). `receiveExternalOrders`
   * `integration.market_id` bo'lmasa 400 beradi.
   */
  key: "market_id",
  label: "Market akkaunti",
  type: "market",
  hint: "Kelgan buyurtmalar shu market hisobiga yoziladi",
};

/** Tashqi maydonlarni bizning maydonlarimizga bog'lash. */
const MAPPING_FIELD: ConnectionField = {
  key: "field_mapping",
  label: "Maydon xaritasi",
  type: "mapping",
  hint: "Saytning JSON maydonlari → bizning maydonlar. Bo'sh bo'lsa standart nomlar ishlatiladi",
};

/**
 * KIRUVCHI WEBHOOK — ular bizga status yuboradi (kargo, to'lov tizimi).
 *
 * Bu maydonlar 0-bosqichda backend DTO'siga qo'shildi; ilgari ularni
 * saqlashning yo'li YO'Q edi (audit EI-04).
 */
const INBOUND_WEBHOOK: ConnectionField[] = [
  {
    key: "webhook_secret",
    label: "Webhook sekreti",
    type: "secret",
    writeOnly: true,
    hint: "HMAC imzo kaliti. Bo'sh qoldirilsa tegilmaydi",
    group: "security",
  },
  {
    key: "webhook_signature_header",
    label: "Imzo sarlavhasi",
    type: "text",
    placeholder: "x-signature",
    hint: "Imzo qaysi HTTP sarlavhada keladi",
    group: "security",
  },
  {
    key: "webhook_signature_prefix",
    label: "Imzo prefiksi",
    type: "text",
    placeholder: "sha256=",
    hint: "Imzo qiymati oldida turadigan matn (bo'lsa)",
    group: "security",
  },
  {
    key: "webhook_algorithm",
    label: "Algoritm",
    type: "select",
    options: [
      { value: "sha256", label: "SHA-256" },
      { value: "sha512", label: "SHA-512" },
    ],
    group: "security",
  },
  {
    key: "webhook_id_header",
    label: "Hodisa id sarlavhasi",
    type: "text",
    placeholder: "x-delivery-id",
    hint: "Takroriy yetkazishni aniqlash uchun (replay guard)",
    group: "security",
  },
];

/**
 * Kiruvchi webhook payloadida posilkani va statusni topish yo'llari.
 *
 * ⚠️ BU RO'YXAT BACKEND O'QIYDIGAN KALITLAR BILAN AYNAN MOS BO'LISHI SHART.
 *
 * Ilgari mos emasdi va ikki tomonlama nuqson bor edi:
 *   • UI `order_id` ni so'rardi — backend uni HECH QACHON o'qimaydi
 *     (`applyWebhookToShipment` faqat `status`, `external_ref`,
 *     `tracking_number` ni o'qiydi). Operator to'ldirardi va hech narsa
 *     bo'lmasdi.
 *   • Backend o'qiydigan `tracking_number` esa UI'da TAKLIF QILINMASDI —
 *     ya'ni kuzatuv raqami bo'yicha moslashni sozlashning yo'li yo'q edi.
 *
 * DTO ichki kalitlarni tekshirmaydi (`@IsObject()`), shuning uchun noto'g'ri
 * kalit jimgina saqlanardi va xato chiqmasdi — aynan shuning uchun bu
 * nomuvofiqlik uzoq sezilmadi.
 */
const WEBHOOK_PATHS: ConnectionField[] = [
  {
    key: "webhook_payload_paths.external_ref",
    label: "Ularning raqami yo'li",
    type: "text",
    placeholder: "data.order.external_id",
    hint: "Posilka shu raqam bo'yicha topiladi",
  },
  {
    key: "webhook_payload_paths.tracking_number",
    label: "Kuzatuv raqami yo'li",
    type: "text",
    placeholder: "data.tracking",
    hint: "Ularning raqami mos kelmasa, posilka shu bo'yicha izlanadi",
  },
  {
    key: "webhook_payload_paths.status",
    label: "Status yo'li",
    type: "text",
    placeholder: "data.order.state",
  },
];

/** Ularning statusi → bizning statusimiz. */
/**
 * VORONKA DARVOZASI — CRM bitimi qachon buyurtmaga aylanadi.
 *
 * ⚠️ NEGA DARVOZA SHART. CRM bitim hayotining HAR qadamida webhook
 * yuboradi — shu jumladan mijoz manzili va telefoni hali to'lmagan "bitim
 * yaratildi" hodisasida ham. Darvoza bo'lmasa birinchi shu chala hodisa
 * buyurtma yasardi, keyin dublikat tekshiruvi to'g'ri ma'lumot kelganda
 * "allaqachon bor" deb tashlab yuborardi — natija CHALA buyurtma bo'lib
 * qotib qolardi.
 *
 * Shu bois backend `enabled: true` bo'lsa kamida bitta darvozani TALAB
 * qiladi (400 qaytaradi). Bu yerdagi izohlar o'sha talabni operator
 * formadan chiqmasdan tushunishi uchun.
 */
const FUNNEL_FIELDS: ConnectionField[] = [
  {
    key: "inbound_order_config.enabled",
    label: "Voronkadan buyurtma yaratish",
    type: "switch",
    hint: "Yoqilsa, darvozadan o'tgan bitim buyurtmaga aylanadi",
  },
  {
    key: "inbound_order_config.deal_path",
    label: "Bitim obyekti yo'li",
    type: "text",
    placeholder: "data.lead",
    hint: "Webhook payload'ida bitim qaysi yo'lda turadi",
    showWhen: { key: "inbound_order_config.enabled", equals: true },
  },
  {
    key: "inbound_order_config.stage_path",
    label: "Bosqich yo'li",
    type: "text",
    placeholder: "status_id",
    hint: "Bosqich id'si bitim ichida qaysi maydonda",
    showWhen: { key: "inbound_order_config.enabled", equals: true },
  },
  {
    key: "inbound_order_config.create_on_stages",
    label: "Qaysi bosqichda yaratilsin",
    type: "tags",
    placeholder: "142",
    hint: "FAQAT shu bosqichlarda buyurtma tug'iladi. Bosqich yoki hodisadan kamida bittasi shart",
    showWhen: { key: "inbound_order_config.enabled", equals: true },
  },
  {
    key: "inbound_order_config.create_on_events",
    label: "Yoki qaysi hodisada",
    type: "tags",
    placeholder: "leads.status",
    hint: "Bosqich id'sini bermaydigan CRM uchun — hodisa turi bo'yicha",
    showWhen: { key: "inbound_order_config.enabled", equals: true },
  },
  {
    key: "inbound_order_config.funnel_path",
    label: "Voronka yo'li",
    type: "text",
    placeholder: "pipeline_id",
    hint: "Ixtiyoriy — bir nechta voronkadan faqat bittasini olish uchun",
    showWhen: { key: "inbound_order_config.enabled", equals: true },
  },
  {
    key: "inbound_order_config.funnel_id",
    label: "Faqat shu voronka",
    type: "text",
    placeholder: "7482913",
    hint: "Bo'sh bo'lsa barcha voronka qabul qilinadi",
    showWhen: { key: "inbound_order_config.enabled", equals: true },
  },
];

/**
 * ONLAYN TO'LOV SOZLAMASI — `role='payment'` uchun (audit P1/P2).
 *
 * ⚠️ IKKI TUZOQ, IKKISI HAM JIMGINA ISHLAMASLIKKA OLIB BORADI:
 *
 *  1. TIYIN. Payme/Click summani TIYINDA yuboradi: 100 000 so'm →
 *     10 000 000. Bayroq qo'yilmasa summa buyurtma narxidan 100 baravar
 *     oshib, ortiqcha to'lov darvozasiga urilardi — ya'ni HAR BIR to'lov
 *     rad etilardi va sabab uzoq izlanardi.
 *
 *  2. HOLAT XARITASI. Provayderlarning qiymatlari butunlay boshqacha
 *     ("paid", 2, "CONFIRMED"). Xaritasiz hech bir hodisa qo'llanmaydi —
 *     bu ATAYLAB: noma'lum qiymatni "to'landi" deb o'qish eng xavfli xato
 *     bo'lardi (kuryer naqd yig'masdi, pul esa kelmasdi).
 */
const PAYMENT_FIELDS: ConnectionField[] = [
  {
    key: "payment_config.enabled",
    label: "To'lovni qabul qilish",
    type: "switch",
    hint: "Yoqilsa, tasdiqlangan to'lov buyurtmaga yoziladi",
  },
  {
    key: "payment_config.transaction_id_path",
    label: "Tranzaksiya id yo'li",
    type: "text",
    placeholder: "data.transaction.id",
    hint: "Takroriy to'lovni to'sish uchun ASOSIY kalit — bo'sh bo'lsa to'lov qo'llanmaydi",
    showWhen: { key: "payment_config.enabled", equals: true },
  },
  {
    key: "payment_config.order_ref_path",
    label: "Buyurtma havolasi yo'li",
    type: "text",
    placeholder: "data.account.order_id",
    hint: "To'lov qaysi buyurtmaga tegishli ekani payload'da qayerda",
    showWhen: { key: "payment_config.enabled", equals: true },
  },
  {
    key: "payment_config.order_ref_field",
    label: "Havola nimaga ishora qiladi",
    type: "select",
    options: [
      { value: "id", label: "Buyurtma raqami (id)" },
      { value: "external_id", label: "Tashqi tizim raqami" },
      { value: "qr_code_token", label: "Skan tokeni" },
    ],
    hint: "Elchi'da buyurtma raqami — `id`ning o'zi",
    showWhen: { key: "payment_config.enabled", equals: true },
  },
  {
    key: "payment_config.amount_path",
    label: "Summa yo'li",
    type: "text",
    placeholder: "data.amount",
    showWhen: { key: "payment_config.enabled", equals: true },
  },
  {
    key: "payment_config.amount_in_tiyin",
    label: "Summa TIYINDA keladi",
    type: "switch",
    hint: "Payme va Click shunday yuboradi. Noto'g'ri qoldirilsa har bir to'lov rad etiladi",
    showWhen: { key: "payment_config.enabled", equals: true },
  },
  {
    key: "payment_config.currency_path",
    label: "Valyuta yo'li",
    type: "text",
    placeholder: "data.currency",
    hint: "Bo'sh bo'lsa UZS deb qabul qilinadi",
    showWhen: { key: "payment_config.enabled", equals: true },
  },
  {
    key: "payment_config.status_path",
    label: "Holat yo'li",
    type: "text",
    placeholder: "data.state",
    showWhen: { key: "payment_config.enabled", equals: true },
  },
  {
    key: "payment_config.status_map",
    label: "Holat xaritasi",
    type: "mapping",
    hint: "Bizning holat → ularning qiymatlari. SHART: xaritasiz hech bir to'lov qo'llanmaydi",
    showWhen: { key: "payment_config.enabled", equals: true },
  },
];

const INBOUND_STATUS_MAP: ConnectionField = {
  key: "inbound_status_mapping",
  label: "Kiruvchi status xaritasi",
  type: "mapping",
  hint: "Ularning status nomi → bizning amal (sell / cancel / return)",
};

/** Posilka jo'natish shabloni — faqat kargoda. */
const DISPATCH_FIELDS: ConnectionField[] = [
  {
    key: "dispatch_config.endpoint",
    label: "Jo'natish endpointi",
    type: "text",
    placeholder: "/v1/orders",
    hint: "Posilka yaratish uchun chaqiriladigan manzil",
  },
  {
    key: "dispatch_config.method",
    label: "Metod",
    type: "select",
    options: [
      { value: "POST", label: "POST" },
      { value: "PUT", label: "PUT" },
    ],
  },
  {
    key: "dispatch_config.body_template",
    label: "So'rov tanasi shabloni",
    type: "mapping",
    hint: "Ularning maydoni → bizning qiymat. Qiymatda {{customer_name}} kabi o'rin egallari ishlatiladi",
  },
  {
    key: "dispatch_config.response_paths",
    label: "Javob yo'llari",
    type: "mapping",
    hint: "Javobdan nima olinadi: external_ref, tracking_number",
  },
];

/** Chiquvchi status yuborish — biz ularga xabar beramiz. */
const OUTBOUND_STATUS_FIELDS: ConnectionField[] = [
  {
    key: "status_sync_config.external_update.endpoint",
    label: "Status yuborish endpointi",
    type: "text",
    placeholder: "/v1/orders/status",
    hint: "Status o'zgarganda shu manzilga so'rov ketadi",
  },
  {
    key: "status_sync_config.external_update.method",
    label: "Metod",
    type: "select",
    options: [
      { value: "POST", label: "POST" },
      { value: "PUT", label: "PUT" },
      { value: "PATCH", label: "PATCH" },
      { value: "GET", label: "GET" },
    ],
  },
  {
    key: "status_mapping",
    label: "Chiquvchi status xaritasi",
    type: "mapping",
    hint: "Bizning status/amal → ularning status nomi. rollback ham kiritilishi kerak",
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
    key: "marketplace_inbound",
    label: "Marketplace (bizga ulanadi)",
    desc: "Uzum, Olcha va h.k. — bizning API orqali buyurtma yuboradi",
    kind: "partner",
    role: "source",
    category: "marketplace",
    fields: INBOUND_FIELDS,
    prereqs: [
      "Ularning tomonida HTTPS webhook manzili (status shu yerga boradi)",
      "Imzoni tekshirish uchun kelishilgan sekret (ixtiyoriy, lekin tavsiya)",
      "Ularning so\u2019rov yuboradigan IP manzillari (ixtiyoriy cheklov)",
    ],
  },
  {
    key: "marketplace_outbound",
    label: "Marketplace (biz ulanamiz)",
    desc: "Buyurtmani biz tortib olamiz — ularning API'siga moslashamiz",
    kind: "integration",
    role: "source",
    category: "marketplace",
    /**
     * Biz ularning API'sidan buyurtma tortib olamiz. Kargo emas — posilka
     * jo'natish sozlamasi KERAK EMAS.
     */
    fields: [
      NAME_FIELD,
      SLUG_FIELD,
      MARKET_FIELD,
      ...OUTBOUND_AUTH,
      MAPPING_FIELD,
      ...OUTBOUND_STATUS_FIELDS,
    ],
    prereqs: [
      "Ularning API manzili (HTTPS)",
      "API kalit yoki login+parol",
      "Qaysi buyurtmalarni tortib olishimiz kelishilgan bo\u2019lishi",
    ],
  },
  {
    key: "crm",
    label: "CRM",
    desc: "Bitrix24, amoCRM — voronkadan buyurtma",
    kind: "integration",
    role: "source",
    category: "crm",
    /**
     * CRM — YO'NALISH TESKARI. Marketplace buyurtmani tayyor holda beradi;
     * CRM'da esa bitim voronkada yuradi va faqat KERAKLI bosqichga yetganda
     * buyurtmaga aylanadi.
     *
     * Shu bois bu turda kiruvchi webhook sozlamasi ham (`INBOUND_WEBHOOK` —
     * imzo sekreti va sarlavhalari) va voronka darvozasi ham bor. Ilgari
     * turda faqat CHIQUVCHI kirish bor edi, ya'ni CRM bizga hodisa yubora
     * olmasdi (audit P5) — sozlaydigan joy yo'qligi uchun.
     *
     * `MAPPING_FIELD` — bitim maydonlari (telefon, manzil, tuman, narx)
     * qaysi nomda kelishini aytadi; buyurtma yaratish o'sha xaritaga
     * tayanadi.
     */
    fields: [
      NAME_FIELD,
      SLUG_FIELD,
      MARKET_FIELD,
      ...OUTBOUND_AUTH,
      MAPPING_FIELD,
      ...FUNNEL_FIELDS,
      ...INBOUND_WEBHOOK,
      ...OUTBOUND_STATUS_FIELDS,
    ],
    prereqs: [
      "CRM API manzili (HTTPS)",
      "API kalit yoki login+parol",
      "Qaysi voronka va BOSQICHDA buyurtma yaratilishi",
      "Bitim maydonlari nomlari (telefon, manzil, tuman, narx)",
    ],
  },
  {
    key: "carrier",
    label: "Yetkazuvchi",
    desc: "Bizdan posilka oladi va yetkazadi. COD puli ular orqali qaytadi",
    kind: "integration",
    role: "carrier",
    category: "cargo",
    /**
     * YETKAZUVCHI — yagona tur, unda POSILKA JO'NATISH sozlamasi bor.
     * Market maydoni YO'Q: kargo buyurtma bermaydi, u posilkani oladi.
     */
    fields: [
      NAME_FIELD,
      SLUG_FIELD,
      ...OUTBOUND_AUTH,
      ...DISPATCH_FIELDS,
      ...INBOUND_WEBHOOK,
      ...WEBHOOK_PATHS,
      INBOUND_STATUS_MAP,
    ],
    prereqs: [
      "Yetkazuvchining API manzili (HTTPS)",
      "API kalit",
      "Tarif va qaytarish shartlari kelishilgan bo\u2019lishi",
    ],
  },
  {
    key: "payment",
    label: "To'lov tizimi",
    desc: "Payme, Click, bank — to'lov holatini tasdiqlaydi",
    kind: "integration",
    role: "payment",
    category: "payment",
    /**
     * TO'LOV TIZIMI — faqat KIRUVCHI webhook: ular to'lov tasdig'ini
     * yuboradi. Posilka jo'natish ham, market bog'lanishi ham kerak emas.
     *
     * ✅ 7-bosqichda oqim QURILDI (audit P1/P2): `payment_config` bo'yicha
     * tranzaksiya, summa, holat va buyurtma havolasi o'qiladi; tasdiqlangan
     * to'lov `payment_transactions` ga yozilib buyurtmaga qo'llanadi.
     *
     * ⚠️ POSILKA YO'LLARI (`WEBHOOK_PATHS`) OLIB TASHLANDI — to'lov
     * hodisasida posilka YO'Q. Ilgari bu yerda turgani chalg'itardi:
     * operator ularni to'ldirardi va hech narsa bo'lmasdi.
     *
     * ⚠️ PUL KASSAGA YOZILMAYDI (foydalanuvchi qarori, 2026-09-13) — faqat
     * daftarga va buyurtmaning to'lov maydonlariga. Kompaniya balansi bu
     * pulni hali ko'rmaydi.
     */
    fields: [NAME_FIELD, SLUG_FIELD, ...OUTBOUND_AUTH, ...PAYMENT_FIELDS, ...INBOUND_WEBHOOK],
    prereqs: [
      "To\u2019lov tizimining API manzili (HTTPS)",
      "Savdo nuqtasi (merchant) kaliti",
      "Qaysi to\u2019lov holati tasdiq deb qabul qilinishi",
    ],
  },
  {
    key: "mirror",
    label: "Ko'zgu (eksport)",
    desc: "Sheets, BI — faqat o'qish uchun. Hech narsani o'zgartirmaydi",
    kind: "integration",
    role: "mirror",
    category: "spreadsheet",
    /**
     * KO'ZGU — faqat CHIQUVCHI: biz ularga yozamiz. Kiruvchi webhook ham,
     * market ham, dispatch ham kerak emas.
     */
    fields: [NAME_FIELD, SLUG_FIELD, ...OUTBOUND_AUTH, ...OUTBOUND_STATUS_FIELDS],
    prereqs: [
      "Eksport manzili (HTTPS)",
      "Yozish huquqi bo\u2019lgan kalit",
      "Qaysi maydonlar chiqarilishi",
    ],
  },
];

/** Rol bo'yicha guruhlash tartibi — ro'yxatda shu ketma-ketlikda chiqadi. */
export const ROLE_ORDER: IntegrationRole[] = ["source", "carrier", "payment", "mirror"];

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
  group: "connection" | "security" | "sandbox",
): ConnectionField[] => fields.filter((f) => (f.group ?? "connection") === group);

/* ═══════════════════════════════════════════════════════════════════════
   TURNI O'ZGARTIRISH — ALOHIDA AMAL, oddiy maydon EMAS.

   ⚠️ ILGARI `role`/`category` oddiy `select` bo'lib Sozlamalar formasida
   turardi. Ikki muammo tug'ilgandi:

   1) USTADA ham ko'rinardi, lekin qiymati JIMGINA TASHLANARDI — usta
      `role`/`category`ni KARTADAN oladi va formadagi tanlovni bosib
      ketardi (audit FE-04). Ya'ni operator tanlaydi, natija esa boshqa.

   2) Katalog tanlovi MA'NOSIZLANARDI: "Marketplace" kartasini tanlab,
      ichida turni "Yetkazuvchi" ga o'zgartirish mumkin bo'lardi
      (audit FE-05).

   Endi: usta bu maydonlarni KO'RSATMAYDI, Sozlamalar esa ularni alohida
   "Turini o'zgartirish" bo'limida, ogohlantirish bilan ko'rsatadi.

   Nega butunlay olib tashlamadik: Donoxon kabi noto'g'ri tasniflangan
   ulanishni tuzatish kerak (migratsiya mavjud yozuvlarga sukut `carrier`
   qo'ygan) — busiz u abadiy "yetkazuvchi" bo'lib qolardi.

   ⚠️ Qiymatlar backend `@IsIn` ro'yxati bilan AYNAN bir xil.
   ═══════════════════════════════════════════════════════════════════════ */
export const TYPE_CHANGE_FIELDS: ConnectionField[] = [
  {
    key: "role",
    label: "Roli",
    type: "select",
    options: [
      { value: "source", label: "Buyurtma manbasi — bizga buyurtma beradi" },
      { value: "carrier", label: "Yetkazuvchi — bizdan posilka oladi" },
      { value: "payment", label: "To'lov tizimi" },
      { value: "mirror", label: "Ko'zgu — faqat eksport" },
    ],
    hint: "Ulanish nima qiladi",
  },
  {
    key: "category",
    label: "Turi",
    type: "select",
    options: [
      { value: "marketplace", label: "Marketplace / sayt" },
      { value: "crm", label: "CRM" },
      { value: "cargo", label: "Kargo" },
      { value: "payment", label: "To'lov" },
      { value: "spreadsheet", label: "Jadval / hisobot" },
      { value: "other", label: "Boshqa" },
    ],
    hint: "Faqat tasnif uchun",
  },
];

/**
 * `showWhen` sharti bajarilgan maydonlarni qaytaradi.
 *
 * Sharti yo'q maydon HAR DOIM ko'rinadi — yangi maydon qo'shganda uni
 * unutib qoldirsak, u yashirinib qolmaydi. Teskari sukut xavfli bo'lardi.
 */
/**
 * SHART SOLISHTIRISH — `showWhen` va `disabledWhen` uchun YAGONA qoida.
 *
 * ⚠️ BOOLEAN SHARTDA `undefined` — `false` DEGANI. Ilgari ikki tomon ham
 * satrga aylantirilardi va `undefined` → `''` bo'lib, `'false'` bilan
 * teng chiqmasdi. Natijada yangi hamkorda (`sandbox_enabled` hali yo'q)
 * `disabledWhen: { equals: false }` ISHLAMASDI: maydon tahrirlanadigan
 * bo'lib turardi, holbuki kalit o'chiq edi. Test aynan shuni ushladi.
 *
 * Satr shartlarida esa aniq tenglik kerak (`auth_type === 'api_key'`),
 * shu bois tur bo'yicha ajratiladi.
 */
const conditionMet = (value: unknown, equals: string | boolean): boolean =>
  typeof equals === "boolean" ? Boolean(value) === equals : String(value ?? "") === equals;

/**
 * Maydon O'CHIRILGANMI (ko'rinadi, lekin tahrirlanmaydi).
 *
 * `visibleFields` bilan AYNI solishtirish qoidasini ishlatadi.
 */
export const isFieldDisabled = (field: ConnectionField, values: Record<string, unknown>): boolean =>
  Boolean(
    field.disabledWhen && conditionMet(values[field.disabledWhen.key], field.disabledWhen.equals),
  );

export const visibleFields = (
  fields: ConnectionField[],
  values: Record<string, unknown>,
): ConnectionField[] =>
  fields.filter((f) => {
    if (!f.showWhen) return true;
    /**
     * `conditionMet` — `disabledWhen` bilan AYNI qoida: boolean shartda
     * `undefined` `false` deb o'qiladi, satr shartida aniq tenglik.
     *
     * Kalit NUQTALI bo'lishi mumkin (`inbound_order_config.enabled`) —
     * forma holati yassi saqlanadi va `nestPayload` faqat yuborishda
     * ichma-ich qiladi, shuning uchun to'g'ridan-to'g'ri o'qish ishlaydi.
     */
    return conditionMet(values[f.showWhen.key], f.showWhen.equals);
  });
