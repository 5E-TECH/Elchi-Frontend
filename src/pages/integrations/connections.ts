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
  /**
   * ⚠️ MATN EMAS, i18n KALITI (`integrations` nomlar fazosi).
   *
   * Ilgari bu yerda o'zbekcha matn turardi va sahifa i18n'dan tashqarida
   * edi: til almashtirilganda barcha forma yorlig'i o'zbekcha qolib
   * ketardi. Chizuvchi (`ConnectionFields`) `t(field.labelKey)` qiladi.
   */
  labelKey: string;
  type: FieldType;
  /** Bir qatorlik izoh — maydon ostida chiqadi (i18n kaliti). */
  hintKey?: string;
  placeholder?: string;
  /**
   * `select` uchun variantlar.
   *
   * ⚠️ Protokol tokenlari (`SHA-256`, `POST`, `CRM`) ATAYLAB matn bo'lib
   * qoladi: ular uchala tilda ayni va tarjimaga qo'shish 20 ta keraksiz
   * yozuv hamda mistarjima xavfini yaratardi. Shu bois `labelKey` yoki
   * `label` — ikkisidan biri bo'ladi.
   */
  options?: Array<{ value: string } & ({ labelKey: string } | { label: string })>;
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
  /** i18n kaliti — `ConnectionField.labelKey` bilan ayni sabab. */
  labelKey: string;
  /** Tanlash kartasidagi bir qatorlik tavsif (i18n kaliti). */
  descKey: string;
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
  /** Katalog kartasidagi "sizga kerak bo'ladi" ro'yxati (i18n kalitlari). */
  prereqKeys: string[];
}

/** Har turda takrorlanadigan maydonlar — bir joyda. */
const NAME_FIELD: ConnectionField = {
  key: "name",
  labelKey: "fNameLabel",
  type: "text",
  placeholder: "Uzum Market",
  hintKey: "fNameHint",
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
    labelKey: "fWebhookUrlLabel",
    type: "url",
    placeholder: "https://partner.example.com/elchi/webhook",
    hintKey: "fWebhookUrlHint",
  },
  {
    key: "webhook_secret",
    labelKey: "fWebhookSecretLabel",
    type: "secret",
    writeOnly: true,
    hintKey: "fWebhookSecretHint",
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
    labelKey: "fSandboxEnabledLabel",
    type: "switch",
    hintKey: "fSandboxEnabledHint",
    group: "sandbox",
  },
  {
    key: "sandbox_webhook_url",
    labelKey: "fSandboxWebhookUrlLabel",
    type: "url",
    placeholder: "https://dev.partner.example.com/elchi/webhook",
    hintKey: "fSandboxWebhookUrlHint",
    group: "sandbox",
    disabledWhen: { key: "sandbox_enabled", equals: false },
  },
  {
    key: "sandbox_webhook_secret",
    labelKey: "fSandboxWebhookSecretLabel",
    type: "secret",
    writeOnly: true,
    /**
     * ⚠️ HINT O'ZGARDI. Ilgari "Berilmasa asosiy sekret ishlatiladi" deb
     * yozilgan edi — va kod haqiqatan shunday qilardi, ya'ni PRODAKSHN
     * imzo kaliti dev hostga yuborilardi. Sinov muhitlari kamroq
     * himoyalangan; kalit oqsa u bilan HAQIQIY webhook imzolash mumkin
     * bo'lardi. Endi alohida sekret SHART.
     */
    hintKey: "fSandboxWebhookSecretHint",
    group: "sandbox",
    disabledWhen: { key: "sandbox_enabled", equals: false },
  },
  {
    key: "ip_allowlist",
    labelKey: "fIpAllowlistLabel",
    type: "tags",
    placeholder: "203.0.113.10 yoki 203.0.113.0/24",
    hintKey: "fIpAllowlistHint",
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
  labelKey: "fSlugLabel",
  type: "text",
  placeholder: "donoxon",
  hintKey: "fSlugHint",
};

/** Biz ularga so'rov yuboradigan manzil + kirish. */
const OUTBOUND_AUTH: ConnectionField[] = [
  {
    key: "base_url",
    labelKey: "fBaseUrlLabel",
    type: "url",
    placeholder: "https://api.donoxon.uz",
    hintKey: "fBaseUrlHint",
  },
  {
    key: "auth_type",
    labelKey: "fAuthTypeLabel",
    type: "select",
    options: [
      { value: "api_key", labelKey: "fOptApiKeyLabel" },
      { value: "login", labelKey: "fOptLoginLabel" },
    ],
    hintKey: "fAuthTypeHint",
  },
  {
    key: "api_key",
    labelKey: "fOptApiKeyLabel",
    type: "secret",
    writeOnly: true,
    hintKey: "fApiKeyHint",
    group: "security",
    showWhen: { key: "auth_type", equals: "api_key" },
  },
  {
    key: "auth_url",
    labelKey: "fAuthUrlLabel",
    type: "url",
    placeholder: "https://api.donoxon.uz/auth/login",
    hintKey: "fAuthUrlHint",
    showWhen: { key: "auth_type", equals: "login" },
  },
  {
    key: "username",
    labelKey: "fUsernameLabel",
    type: "text",
    showWhen: { key: "auth_type", equals: "login" },
  },
  {
    key: "password",
    labelKey: "fPasswordLabel",
    type: "secret",
    writeOnly: true,
    hintKey: "fApiKeyHint",
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
  labelKey: "fMarketIdLabel",
  type: "market",
  hintKey: "fMarketIdHint",
};

/** Tashqi maydonlarni bizning maydonlarimizga bog'lash. */
const MAPPING_FIELD: ConnectionField = {
  key: "field_mapping",
  labelKey: "fFieldMappingLabel",
  type: "mapping",
  hintKey: "fFieldMappingHint",
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
    labelKey: "fWebhookSecretLabel",
    type: "secret",
    writeOnly: true,
    hintKey: "fWebhookSecretHint2",
    group: "security",
  },
  {
    key: "webhook_signature_header",
    labelKey: "fWebhookSignatureHeaderLabel",
    type: "text",
    placeholder: "x-signature",
    hintKey: "fWebhookSignatureHeaderHint",
    group: "security",
  },
  {
    key: "webhook_signature_prefix",
    labelKey: "fWebhookSignaturePrefixLabel",
    type: "text",
    placeholder: "sha256=",
    hintKey: "fWebhookSignaturePrefixHint",
    group: "security",
  },
  {
    key: "webhook_algorithm",
    labelKey: "fWebhookAlgorithmLabel",
    type: "select",
    options: [
      { value: "sha256", label: "SHA-256" },
      { value: "sha512", label: "SHA-512" },
    ],
    group: "security",
  },
  {
    key: "webhook_id_header",
    labelKey: "fWebhookIdHeaderLabel",
    type: "text",
    placeholder: "x-delivery-id",
    hintKey: "fWebhookIdHeaderHint",
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
    labelKey: "fWebhookPayloadPathsExternalRefLabel",
    type: "text",
    placeholder: "data.order.external_id",
    hintKey: "fWebhookPayloadPathsExternalRefHint",
  },
  {
    key: "webhook_payload_paths.tracking_number",
    labelKey: "fWebhookPayloadPathsTrackingNumberLabel",
    type: "text",
    placeholder: "data.tracking",
    hintKey: "fWebhookPayloadPathsTrackingNumberHint",
  },
  {
    key: "webhook_payload_paths.status",
    labelKey: "fWebhookPayloadPathsStatusLabel",
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
    labelKey: "fInboundOrderConfigEnabledLabel",
    type: "switch",
    hintKey: "fInboundOrderConfigEnabledHint",
  },
  {
    key: "inbound_order_config.deal_path",
    labelKey: "fInboundOrderConfigDealPathLabel",
    type: "text",
    placeholder: "data.lead",
    hintKey: "fInboundOrderConfigDealPathHint",
    showWhen: { key: "inbound_order_config.enabled", equals: true },
  },
  {
    key: "inbound_order_config.stage_path",
    labelKey: "fInboundOrderConfigStagePathLabel",
    type: "text",
    placeholder: "status_id",
    hintKey: "fInboundOrderConfigStagePathHint",
    showWhen: { key: "inbound_order_config.enabled", equals: true },
  },
  {
    key: "inbound_order_config.create_on_stages",
    labelKey: "fInboundOrderConfigCreateOnStagesLabel",
    type: "tags",
    placeholder: "142",
    hintKey: "fInboundOrderConfigCreateOnStagesHint",
    showWhen: { key: "inbound_order_config.enabled", equals: true },
  },
  {
    key: "inbound_order_config.create_on_events",
    labelKey: "fInboundOrderConfigCreateOnEventsLabel",
    type: "tags",
    placeholder: "leads.status",
    hintKey: "fInboundOrderConfigCreateOnEventsHint",
    showWhen: { key: "inbound_order_config.enabled", equals: true },
  },
  {
    key: "inbound_order_config.funnel_path",
    labelKey: "fInboundOrderConfigFunnelPathLabel",
    type: "text",
    placeholder: "pipeline_id",
    hintKey: "fInboundOrderConfigFunnelPathHint",
    showWhen: { key: "inbound_order_config.enabled", equals: true },
  },
  {
    key: "inbound_order_config.funnel_id",
    labelKey: "fInboundOrderConfigFunnelIdLabel",
    type: "text",
    placeholder: "7482913",
    hintKey: "fInboundOrderConfigFunnelIdHint",
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
    labelKey: "fPaymentConfigEnabledLabel",
    type: "switch",
    hintKey: "fPaymentConfigEnabledHint",
  },
  {
    key: "payment_config.transaction_id_path",
    labelKey: "fPaymentConfigTransactionIdPathLabel",
    type: "text",
    placeholder: "data.transaction.id",
    hintKey: "fPaymentConfigTransactionIdPathHint",
    showWhen: { key: "payment_config.enabled", equals: true },
  },
  {
    key: "payment_config.order_ref_path",
    labelKey: "fPaymentConfigOrderRefPathLabel",
    type: "text",
    placeholder: "data.account.order_id",
    hintKey: "fPaymentConfigOrderRefPathHint",
    showWhen: { key: "payment_config.enabled", equals: true },
  },
  {
    key: "payment_config.order_ref_field",
    labelKey: "fPaymentConfigOrderRefFieldLabel",
    type: "select",
    options: [
      { value: "id", labelKey: "fOptIdLabel" },
      { value: "external_id", labelKey: "fOptExternalIdLabel" },
      { value: "qr_code_token", labelKey: "fOptQrCodeTokenLabel" },
    ],
    hintKey: "fPaymentConfigOrderRefFieldHint",
    showWhen: { key: "payment_config.enabled", equals: true },
  },
  {
    key: "payment_config.amount_path",
    labelKey: "fPaymentConfigAmountPathLabel",
    type: "text",
    placeholder: "data.amount",
    showWhen: { key: "payment_config.enabled", equals: true },
  },
  {
    key: "payment_config.amount_in_tiyin",
    labelKey: "fPaymentConfigAmountInTiyinLabel",
    type: "switch",
    hintKey: "fPaymentConfigAmountInTiyinHint",
    showWhen: { key: "payment_config.enabled", equals: true },
  },
  {
    key: "payment_config.currency_path",
    labelKey: "fPaymentConfigCurrencyPathLabel",
    type: "text",
    placeholder: "data.currency",
    hintKey: "fPaymentConfigCurrencyPathHint",
    showWhen: { key: "payment_config.enabled", equals: true },
  },
  {
    key: "payment_config.status_path",
    labelKey: "fPaymentConfigStatusPathLabel",
    type: "text",
    placeholder: "data.state",
    showWhen: { key: "payment_config.enabled", equals: true },
  },
  {
    key: "payment_config.status_map",
    labelKey: "fPaymentConfigStatusMapLabel",
    type: "mapping",
    hintKey: "fPaymentConfigStatusMapHint",
    showWhen: { key: "payment_config.enabled", equals: true },
  },
];

const INBOUND_STATUS_MAP: ConnectionField = {
  key: "inbound_status_mapping",
  labelKey: "fInboundStatusMappingLabel",
  type: "mapping",
  hintKey: "fInboundStatusMappingHint",
};

/** Posilka jo'natish shabloni — faqat kargoda. */
const DISPATCH_FIELDS: ConnectionField[] = [
  {
    key: "dispatch_config.endpoint",
    labelKey: "fDispatchConfigEndpointLabel",
    type: "text",
    placeholder: "/v1/orders",
    hintKey: "fDispatchConfigEndpointHint",
  },
  {
    key: "dispatch_config.method",
    labelKey: "fDispatchConfigMethodLabel",
    type: "select",
    options: [
      { value: "POST", label: "POST" },
      { value: "PUT", label: "PUT" },
    ],
  },
  {
    key: "dispatch_config.body_template",
    labelKey: "fDispatchConfigBodyTemplateLabel",
    type: "mapping",
    hintKey: "fDispatchConfigBodyTemplateHint",
  },
  {
    key: "dispatch_config.response_paths",
    labelKey: "fDispatchConfigResponsePathsLabel",
    type: "mapping",
    hintKey: "fDispatchConfigResponsePathsHint",
  },
];

/** Chiquvchi status yuborish — biz ularga xabar beramiz. */
const OUTBOUND_STATUS_FIELDS: ConnectionField[] = [
  {
    key: "status_sync_config.external_update.endpoint",
    labelKey: "fStatusSyncConfigExternalUpdateEndpointLabel",
    type: "text",
    placeholder: "/v1/orders/status",
    hintKey: "fStatusSyncConfigExternalUpdateEndpointHint",
  },
  {
    key: "status_sync_config.external_update.method",
    labelKey: "fDispatchConfigMethodLabel",
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
    labelKey: "fStatusMappingLabel",
    type: "mapping",
    hintKey: "fStatusMappingHint",
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
    labelKey: "fMarketplaceInboundLabel",
    descKey: "fMarketplaceInboundDesc",
    kind: "partner",
    role: "source",
    category: "marketplace",
    fields: INBOUND_FIELDS,
    prereqKeys: [
      "preUlarningTomonidaHttpsWebhookManzil",
      "preImzoniTekshirishUchunKelishilganSe",
      "preUlarningSoRovYuboradiganIpManz",
    ],
  },
  {
    key: "marketplace_outbound",
    labelKey: "fMarketplaceOutboundLabel",
    descKey: "fMarketplaceOutboundDesc",
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
    prereqKeys: [
      "preUlarningApiManziliHttps",
      "preApiKalitYokiLoginParol",
      "preQaysiBuyurtmalarniTortibOlishimizK",
    ],
  },
  {
    key: "crm",
    labelKey: "fCrmLabel",
    descKey: "fCrmDesc",
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
    prereqKeys: [
      "preCrmApiManziliHttps",
      "preApiKalitYokiLoginParol",
      "preQaysiVoronkaVaBosqichdaBuyurtmaYar",
      "preBitimMaydonlariNomlariTelefonManzi",
    ],
  },
  {
    key: "carrier",
    labelKey: "fCarrierLabel",
    descKey: "fCarrierDesc",
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
    prereqKeys: [
      "preYetkazuvchiningApiManziliHttps",
      "fOptApiKeyLabel",
      "preTarifVaQaytarishShartlariKelishilg",
    ],
  },
  {
    key: "payment",
    labelKey: "fPaymentLabel",
    descKey: "fPaymentDesc",
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
    prereqKeys: [
      "preToLovTiziminingApiManziliHttps",
      "preSavdoNuqtasiMerchantKaliti",
      "preQaysiToLovHolatiTasdiqDebQabul",
    ],
  },
  {
    key: "mirror",
    labelKey: "fMirrorLabel",
    descKey: "fMirrorDesc",
    kind: "integration",
    role: "mirror",
    category: "spreadsheet",
    /**
     * KO'ZGU — faqat CHIQUVCHI: biz ularga yozamiz. Kiruvchi webhook ham,
     * market ham, dispatch ham kerak emas.
     */
    fields: [NAME_FIELD, SLUG_FIELD, ...OUTBOUND_AUTH, ...OUTBOUND_STATUS_FIELDS],
    prereqKeys: [
      "preEksportManziliHttps",
      "preYozishHuquqiBoLganKalit",
      "preQaysiMaydonlarChiqarilishi",
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
    labelKey: "fRoleLabel",
    type: "select",
    options: [
      { value: "source", labelKey: "fOptSourceLabel" },
      { value: "carrier", labelKey: "fOptCarrierLabel" },
      { value: "payment", labelKey: "fPaymentLabel" },
      { value: "mirror", labelKey: "fOptMirrorLabel" },
    ],
    hintKey: "fRoleHint",
  },
  {
    key: "category",
    labelKey: "fCategoryLabel",
    type: "select",
    options: [
      { value: "marketplace", labelKey: "fOptMarketplaceLabel" },
      { value: "crm", label: "CRM" },
      { value: "cargo", labelKey: "fOptCargoLabel" },
      { value: "payment", labelKey: "fOptPaymentLabel" },
      { value: "spreadsheet", labelKey: "fOptSpreadsheetLabel" },
      { value: "other", labelKey: "fOptOtherLabel" },
    ],
    hintKey: "fCategoryHint",
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
