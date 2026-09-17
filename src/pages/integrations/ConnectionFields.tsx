import { Form, Input, Select, Switch } from "antd";
import { useTranslation } from "react-i18next";
import { useMarkets } from "../../entities/markets";
import { isFieldDisabled, visibleFields } from "./connections";
import { nestPayload } from "./fieldPath";
import type { ConnectionField } from "./connections";

/**
 * UMUMIY ULANISH FORMASI — maydon ro'yxatidan o'zini yasaydi.
 *
 * NEGA UMUMIY. Foydalanuvchi talabi: "Marketplacelar bilan ulashlar, va boshqa
 * tizimlar bilan ulashni ham deyarli bir xil UI da qil, faqat so'raydigan va
 * ulaydigan qiymatlari farqli bo'lsa faqat shular boshqa bo'lsin".
 *
 * Ilgari har xil ulanish uchun alohida forma yozilgan edi — `partners`
 * sahifasida bir xil, `external_orders` sahifasida boshqa xil. Ikki forma
 * bir ishni bajarardi, lekin ko'rinishi, terminologiyasi va tekshiruvlari
 * boshqacha edi. Yangi tur qo'shilganda uchinchi forma kerak bo'lardi.
 *
 * Endi forma BITTA, farq faqat `connections.ts` dagi maydon ro'yxatida.
 */

/**
 * Maydon qiymatlari.
 *
 * `Record<string, string>` — `mapping` turi uchun (kalit→qiymat xaritasi).
 * Boshqa turlar satr/mantiq/massiv ishlatadi.
 */
export type FieldValue = string | boolean | string[] | Record<string, string>;

export type FieldValues = Record<string, FieldValue>;

interface Props {
  fields: ConnectionField[];
  values: FieldValues;
  onChange: (key: string, value: FieldValue) => void;
  /** Tahrirlashda sir maydonlari bo'sh ko'rinadi — bu ATAYLAB (pastga qara). */
  disabled?: boolean;
}

/**
 * ⚠️ NAZORATLAR antd'dan. Ilgari bu yerda qo'lda yozilgan `<input>` va
 * `<select>` turardi. PCS esa `Form.Item` + antd `Input`/`Select`/`Switch`
 * ishlatadi va foydalanuvchi aynan o'sha ko'rinishni tanladi. Bonus: fokus
 * halqasi, xato holati va o'lchamlar butun ilova bo'ylab bir xil bo'ladi.
 *
 * `Form.Item` bu yerda `name` BERILMASDAN ishlatiladi — qiymatlar tashqi
 * state'da (`values`) va antd Form store'iga bog'lanmaydi. Sabab: forma
 * registrdan yasaladi va maydon to'plami ulanish turiga qarab o'zgaradi;
 * antd store bilan sinxron ushlash keraksiz murakkablik bo'lardi.
 */
const ConnectionFields = ({ fields, values, onChange, disabled }: Props) => {
  const { t } = useTranslation("integrations");
  return (
    <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
      {/*
      Shartli maydonlar yashiriladi: `auth_type` "API kalit" bo'lsa
      login/parol keraksiz. Ilgari to'rttasi BIRGA ko'rinardi va operator
      qaysi ikkitasini to'ldirish kerakligini taxmin qilardi (audit FE-07).
    */}
      {visibleFields(fields, values).map((field) => {
        const raw = values[field.key];
        /**
         * ⚠️ `disabled` IKKI manbadan: forma saqlanayotgan bo'lsa hammasi,
         * yoki maydonning O'ZI shartli o'chirilgan bo'lsa (`disabledWhen`).
         *
         * Yashirish (`showWhen`) o'rniga o'chirish tanlangan joylar bor —
         * masalan sandbox manzili: kalit o'chirilganda qiymat KO'RINISHI
         * kerak, aks holda operator nima sozlanganini bilmaydi.
         */
        const fieldDisabled = disabled || isFieldDisabled(field, values);

        /* ── Kalit/o'chirgich ── */
        if (field.type === "switch") {
          return (
            <Form.Item
              key={field.key}
              label={t(field.labelKey)}
              extra={field.hintKey ? t(field.hintKey) : undefined}
              className="md:col-span-2"
            >
              <Switch
                checked={Boolean(raw)}
                disabled={fieldDisabled}
                onChange={(checked) => onChange(field.key, checked)}
              />
            </Form.Item>
          );
        }

        /* ── Tanlov ── */
        if (field.type === "select") {
          return (
            <Form.Item
              key={field.key}
              label={t(field.labelKey)}
              extra={field.hintKey ? t(field.hintKey) : undefined}
            >
              <Select
                value={String(raw ?? "")}
                disabled={fieldDisabled}
                onChange={(v) => onChange(field.key, v)}
                options={field.options ?? []}
                placeholder={field.placeholderKey ? t(field.placeholderKey) : field.placeholder}
              />
            </Form.Item>
          );
        }

        /* ── Ro'yxat (IP va h.k.) ── */
        if (field.type === "tags") {
          return (
            <Form.Item
              key={field.key}
              label={t(field.labelKey)}
              extra={field.hintKey ? t(field.hintKey) : undefined}
              className="md:col-span-2"
            >
              {/*
              `mode="tags"` — foydalanuvchi o'zi qiymat kiritadi, tayyor
              ro'yxatdan tanlamaydi. `tokenSeparators` bilan bir necha IP'ni
              vergul orqali birdan qo'yish mumkin.
            */}
              <Select
                mode="tags"
                value={Array.isArray(raw) ? raw : []}
                disabled={fieldDisabled}
                onChange={(v: string[]) => onChange(field.key, v)}
                tokenSeparators={[",", " ", "\n"]}
                placeholder={field.placeholderKey ? t(field.placeholderKey) : field.placeholder}
                open={false}
                suffixIcon={null}
              />
            </Form.Item>
          );
        }

        /* ── Market akkaunti (ro'yxat API'dan) ── */
        if (field.type === "market") {
          return (
            <MarketField
              key={field.key}
              field={field}
              value={String(raw ?? "")}
              disabled={fieldDisabled}
              onChange={(v) => onChange(field.key, v)}
            />
          );
        }

        /* ── Maydon xaritasi (JSON) ── */
        if (field.type === "mapping") {
          return (
            <MappingField
              key={field.key}
              field={field}
              value={raw}
              disabled={fieldDisabled}
              onChange={(v) => onChange(field.key, v)}
            />
          );
        }

        /* ── Sir ── */
        if (field.type === "secret") {
          return (
            <Form.Item
              key={field.key}
              label={t(field.labelKey)}
              /**
               * ⚠️ Sir maydoni BO'SH boshlanadi va bu ataylab: server uni
               * qaytarmaydi (faqat shifrlangan holda saqlanadi). Bo'sh
               * qoldirilsa `buildChangedPayload` uni YUBORMAYDI, ya'ni ishlab
               * turgan kalit saqlanadi. Izoh shuni aytib turishi kerak, aks
               * holda operator "kalit yo'qolgan" deb o'ylardi.
               */
              extra={field.hintKey ? t(field.hintKey) : undefined}
            >
              <Input.Password
                value={String(raw ?? "")}
                disabled={fieldDisabled}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={t("fldSecretUntouched")}
                autoComplete="new-password"
              />
            </Form.Item>
          );
        }

        /* ── Matn / manzil ── */
        return (
          <Form.Item
            key={field.key}
            label={t(field.labelKey)}
            extra={field.hintKey ? t(field.hintKey) : undefined}
          >
            <Input
              value={String(raw ?? "")}
              disabled={fieldDisabled}
              onChange={(e) => onChange(field.key, e.target.value)}
              placeholder={field.placeholderKey ? t(field.placeholderKey) : field.placeholder}
              inputMode={field.type === "url" ? "url" : undefined}
            />
          </Form.Item>
        );
      })}
    </div>
  );
};

/**
 * Market tanlagichi — ro'yxat API'dan yuklanadi.
 *
 * ⚠️ QIYMAT SATR bo'lib qoladi (`market_id` bigint). Songa aylantirmaymiz:
 * JS `number` katta bigint'ni aniq saqlamaydi va id buzilib ketardi.
 */
const MarketField = ({
  field,
  value,
  disabled,
  onChange,
}: {
  field: ConnectionField;
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}) => {
  const { t } = useTranslation("integrations");
  const { useGetMarkets } = useMarkets();
  const query = useGetMarkets({ limit: 200 });

  /**
   * Javob qobig'i marshrutga qarab farq qiladi — himoyalangan ochish, aks
   * holda tanlagich bo'sh ko'rinib qolardi va sabab bilinmasdi.
   */
  const raw = query.data as { data?: { items?: unknown[] } | unknown[] } | undefined;
  const list = Array.isArray(raw?.data)
    ? (raw!.data as Array<Record<string, unknown>>)
    : Array.isArray((raw?.data as { items?: unknown[] })?.items)
      ? ((raw!.data as { items: unknown[] }).items as Array<Record<string, unknown>>)
      : [];

  return (
    <Form.Item label={t(field.labelKey)} extra={field.hintKey ? t(field.hintKey) : undefined}>
      <Select
        value={value || undefined}
        disabled={disabled}
        loading={query.isLoading}
        onChange={(v: string) => onChange(v ?? "")}
        allowClear
        showSearch
        optionFilterProp="label"
        placeholder={query.isError ? t("fldListFailed") : t("fldPickMarket")}
        options={list.map((m) => ({
          value: String(m.id),
          label: String(m.name ?? m.username ?? `#${m.id}`),
        }))}
      />
    </Form.Item>
  );
};

/**
 * MAYDON XARITASI — kalit→qiymat juftliklari.
 *
 * ⚠️ XOM JSON MAYDONI EMAS. Operator JSON sintaksisini bilishi shart
 * bo'lmasligi kerak: bitta vergul yoki qavs xatosi butun sozlamani
 * buzardi va xato faqat importda chiqardi. Shu bois tayyor kalitlar
 * ro'yxati va har biriga matn maydoni.
 *
 * Kalitlar backend o'qiydigan nomlar bilan AYNAN bir xil
 * (`order-lifecycle.service.ts` → `fieldMapping.*`). Mos kelmasa xarita
 * jimgina e'tiborsiz qolardi.
 */
/**
 * ⚠️ `def` — backend sukut bo'yicha o'qiydigan maydon nomi. U MATNDAN
 * AJRATILGAN: ilgari ko'rsatma "sukut: id" satridan `replace("sukut: ")`
 * bilan kesib olinardi, ya'ni tarjima qilingan zahoti placeholder butun
 * ko'rsatmani ko'rsatib qo'yardi.
 */
const MAPPING_KEYS: Array<{
  key: string;
  labelKey: string;
  def?: string;
  hintKey?: string;
  inArray?: boolean;
}> = [
  { key: "id_field", labelKey: "mapOrderNumber", def: "id" },
  { key: "customer_name_field", labelKey: "mapCustomerName", def: "full_name" },
  { key: "phone_field", labelKey: "mapPhone", def: "phone" },
  { key: "extra_phone_field", labelKey: "mapExtraPhone" },
  { key: "address_field", labelKey: "mapAddress", def: "address" },
  { key: "district_code_field", labelKey: "mapDistrict", def: "district" },
  { key: "region_code_field", labelKey: "mapRegion", hintKey: "mapNumberOnly" },
  { key: "total_price_field", labelKey: "mapAmount", def: "total_price" },
  { key: "delivery_price_field", labelKey: "mapDeliveryPrice" },
  { key: "qr_code_field", labelKey: "mapQrCode", def: "qr_code" },
  { key: "comment_field", labelKey: "mapComment", def: "comment" },
  { key: "items_field", labelKey: "mapItems", def: "items" },
  { key: "item_name_field", labelKey: "mapItemName", def: "name", inArray: true },
  { key: "item_qty_field", labelKey: "mapItemQty", def: "quantity", inArray: true },
];

const MappingField = ({
  field,
  value,
  disabled,
  onChange,
}: {
  field: ConnectionField;
  value: unknown;
  disabled?: boolean;
  onChange: (v: Record<string, string>) => void;
}) => {
  const { t } = useTranslation("integrations");
  const current =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, string>)
      : {};

  const set = (key: string, next: string) => {
    const out = { ...current };
    // Bo'sh qiymat XARITADAN OLINADI — bo'sh satr saqlash backendni
    // "maydon bor, lekin nomi yo'q" holatiga tushirardi.
    if (next.trim()) out[key] = next.trim();
    else delete out[key];
    onChange(out);
  };

  return (
    <Form.Item
      label={t(field.labelKey)}
      extra={field.hintKey ? t(field.hintKey) : undefined}
      className="md:col-span-2"
    >
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        {MAPPING_KEYS.map((m) => (
          <Form.Item
            key={m.key}
            label={t(m.labelKey)}
            extra={
              m.hintKey
                ? t(m.hintKey)
                : m.def
                  ? t(m.inArray ? "mapDefaultInArray" : "mapDefault", { name: m.def })
                  : undefined
            }
          >
            <Input
              value={current[m.key] ?? ""}
              disabled={disabled}
              onChange={(e) => set(m.key, e.target.value)}
              placeholder={m.def}
            />
          </Form.Item>
        ))}
      </div>
    </Form.Item>
  );
};

export default ConnectionFields;

const isPlainObject = (v: unknown): v is Record<string, string> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export const buildChangedPayload = (
  fields: ConnectionField[],
  values: FieldValues,
  initial: FieldValues,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};

  for (const field of fields) {
    const next = values[field.key];
    const prev = initial[field.key];

    if (field.writeOnly) {
      // Sir: faqat yangi qiymat yozilgan bo'lsa.
      if (typeof next === "string" && next.trim()) out[field.key] = next.trim();
      continue;
    }

    if (Array.isArray(next) || Array.isArray(prev)) {
      const a = Array.isArray(next) ? next : [];
      const b = Array.isArray(prev) ? prev : [];
      if (a.join(",") !== b.join(",")) out[field.key] = a;
      continue;
    }

    /**
     * Xarita (obyekt) — JSON bo'yicha solishtiriladi.
     *
     * ⚠️ Kalitlar tartibi turlicha bo'lishi mumkin, shu bois kalitlar
     * SARALANADI. Aks holda ayni xarita "o'zgargan" bo'lib ko'rinib, har
     * saqlashda keraksiz yozuv ketardi.
     */
    if (isPlainObject(next) || isPlainObject(prev)) {
      const norm = (v: unknown) =>
        JSON.stringify(
          Object.fromEntries(
            Object.entries(isPlainObject(v) ? v : {}).sort(([x], [y]) => x.localeCompare(y)),
          ),
        );
      if (norm(next) !== norm(prev)) out[field.key] = isPlainObject(next) ? next : {};
      continue;
    }

    if (typeof next === "boolean") {
      if (next !== Boolean(prev)) out[field.key] = next;
      continue;
    }

    const a = String(next ?? "").trim();
    const b = String(prev ?? "").trim();
    if (a !== b) out[field.key] = a;
  }

  /**
   * ⚠️ ICHMA-ICH SOZLAMA TO'LIQ YUBORILADI — YARIM EMAS.
   *
   * MUAMMO. Backend `updateIntegration` da `Object.assign(row, dto)` ishlatadi,
   * ya'ni jsonb ustun butunlay ALMASHTIRILADI, birlashtirilmaydi. Faqat
   * o'zgargan kalitni yuborsak:
   *
   *   operator `inbound_order_config.stage_path` ni tahrirlaydi
   *     → payload: { inbound_order_config: { stage_path: 'x' } }
   *     → bazada: { stage_path: 'x' }   ← `enabled` va darvozalar YO'QOLDI
   *     → CRM'dan buyurtma kelishi JIMGINA to'xtaydi
   *
   * Xuddi shu tuzoq `dispatch_config` da ham bor edi: `method` ni
   * o'zgartirish `endpoint` va `body_template` ni o'chirib, kargoga posilka
   * jo'natishni buzardi ("dispatch_config.endpoint is required").
   *
   * YECHIM. Bir ildiz ostidagi BIRON kalit o'zgargan bo'lsa, o'sha ildizning
   * BARCHA kalitlari joriy holatdan qo'shiladi — backend to'liq obyekt oladi.
   *
   * Nega backendda deep-merge qilinmadi: u holda kalitni O'CHIRISH imkoni
   * yo'qoladi va API mijozi butun obyektni almashtira olmaydi. Kontrakt
   * ("yuborganingiz yoziladi") oddiy qolsin, to'liqligini UI ta'minlaydi.
   *
   * ⚠️ Bu ildizlarda SIR yo'q (`sanitizeIntegrationRow` faqat `api_key`,
   * `password`, `webhook_secret` kabi YASSI maydonlarni o'chiradi), shu bois
   * to'liq yuborish xavfsiz. Ichma-ich `writeOnly` maydon paydo bo'lsa bu
   * joy qayta ko'rilishi kerak.
   */
  const touchedRoots = new Set(
    Object.keys(out)
      .filter((k) => k.includes("."))
      .map((k) => k.split(".")[0]),
  );
  if (touchedRoots.size) {
    for (const field of fields) {
      if (!field.key.includes(".") || field.writeOnly) continue;
      if (!touchedRoots.has(field.key.split(".")[0])) continue;
      if (field.key in out) continue;
      const value = values[field.key];
      // `undefined` ni yuborish kalitni yo'qotardi — bo'sh qiymat beriladi.
      out[field.key] = value ?? (field.type === "tags" ? [] : field.type === "switch" ? false : "");
    }
  }

  /**
   * Nuqtali kalitlar (`dispatch_config.endpoint`) ichma-ich obyektga
   * yig'iladi — backend ularni shu shaklda kutadi.
   */
  return nestPayload(out);
};
