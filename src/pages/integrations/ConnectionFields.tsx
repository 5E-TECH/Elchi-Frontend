import { Form, Input, Select, Switch } from 'antd';
import { useMarkets } from '../../entities/markets';
import { visibleFields } from './connections';
import { nestPayload } from './fieldPath';
import type { ConnectionField } from './connections';

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
export type FieldValue =
  | string
  | boolean
  | string[]
  | Record<string, string>;

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
const ConnectionFields = ({ fields, values, onChange, disabled }: Props) => (
  <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
    {/*
      Shartli maydonlar yashiriladi: `auth_type` "API kalit" bo'lsa
      login/parol keraksiz. Ilgari to'rttasi BIRGA ko'rinardi va operator
      qaysi ikkitasini to'ldirish kerakligini taxmin qilardi (audit FE-07).
    */}
    {visibleFields(fields, values).map((field) => {
      const raw = values[field.key];

      /* ── Kalit/o'chirgich ── */
      if (field.type === 'switch') {
        return (
          <Form.Item
            key={field.key}
            label={field.label}
            extra={field.hint}
            className="md:col-span-2"
          >
            <Switch
              checked={Boolean(raw)}
              disabled={disabled}
              onChange={(checked) => onChange(field.key, checked)}
            />
          </Form.Item>
        );
      }

      /* ── Tanlov ── */
      if (field.type === 'select') {
        return (
          <Form.Item key={field.key} label={field.label} extra={field.hint}>
            <Select
              value={String(raw ?? '')}
              disabled={disabled}
              onChange={(v) => onChange(field.key, v)}
              options={field.options ?? []}
              placeholder={field.placeholder}
            />
          </Form.Item>
        );
      }

      /* ── Ro'yxat (IP va h.k.) ── */
      if (field.type === 'tags') {
        return (
          <Form.Item
            key={field.key}
            label={field.label}
            extra={field.hint}
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
              disabled={disabled}
              onChange={(v: string[]) => onChange(field.key, v)}
              tokenSeparators={[',', ' ', '\n']}
              placeholder={field.placeholder}
              open={false}
              suffixIcon={null}
            />
          </Form.Item>
        );
      }

      /* ── Market akkaunti (ro'yxat API'dan) ── */
      if (field.type === 'market') {
        return (
          <MarketField
            key={field.key}
            field={field}
            value={String(raw ?? '')}
            disabled={disabled}
            onChange={(v) => onChange(field.key, v)}
          />
        );
      }

      /* ── Maydon xaritasi (JSON) ── */
      if (field.type === 'mapping') {
        return (
          <MappingField
            key={field.key}
            field={field}
            value={raw}
            disabled={disabled}
            onChange={(v) => onChange(field.key, v)}
          />
        );
      }

      /* ── Sir ── */
      if (field.type === 'secret') {
        return (
          <Form.Item
            key={field.key}
            label={field.label}
            /**
             * ⚠️ Sir maydoni BO'SH boshlanadi va bu ataylab: server uni
             * qaytarmaydi (faqat shifrlangan holda saqlanadi). Bo'sh
             * qoldirilsa `buildChangedPayload` uni YUBORMAYDI, ya'ni ishlab
             * turgan kalit saqlanadi. Izoh shuni aytib turishi kerak, aks
             * holda operator "kalit yo'qolgan" deb o'ylardi.
             */
            extra={field.hint}
          >
            <Input.Password
              value={String(raw ?? '')}
              disabled={disabled}
              onChange={(e) => onChange(field.key, e.target.value)}
              placeholder="tegilmaydi"
              autoComplete="new-password"
            />
          </Form.Item>
        );
      }

      /* ── Matn / manzil ── */
      return (
        <Form.Item key={field.key} label={field.label} extra={field.hint}>
          <Input
            value={String(raw ?? '')}
            disabled={disabled}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            inputMode={field.type === 'url' ? 'url' : undefined}
          />
        </Form.Item>
      );
    })}
  </div>
);

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
  const { useGetMarkets } = useMarkets();
  const query = useGetMarkets({ limit: 200 });

  /**
   * Javob qobig'i marshrutga qarab farq qiladi — himoyalangan ochish, aks
   * holda tanlagich bo'sh ko'rinib qolardi va sabab bilinmasdi.
   */
  const raw = query.data as
    | { data?: { items?: unknown[] } | unknown[] }
    | undefined;
  const list = Array.isArray(raw?.data)
    ? (raw!.data as Array<Record<string, unknown>>)
    : Array.isArray((raw?.data as { items?: unknown[] })?.items)
      ? ((raw!.data as { items: unknown[] }).items as Array<
          Record<string, unknown>
        >)
      : [];

  return (
    <Form.Item label={field.label} extra={field.hint}>
      <Select
        value={value || undefined}
        disabled={disabled}
        loading={query.isLoading}
        onChange={(v: string) => onChange(v ?? '')}
        allowClear
        showSearch
        optionFilterProp="label"
        placeholder={
          query.isError ? "Ro'yxatni olib bo'lmadi" : 'Marketni tanlang'
        }
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
const MAPPING_KEYS: Array<{ key: string; label: string; hint: string }> = [
  { key: 'id_field', label: 'Buyurtma raqami', hint: 'sukut: id' },
  { key: 'customer_name_field', label: 'Mijoz ismi', hint: 'sukut: full_name' },
  { key: 'phone_field', label: 'Telefon', hint: 'sukut: phone' },
  { key: 'extra_phone_field', label: "Qo'shimcha telefon", hint: '' },
  { key: 'address_field', label: 'Manzil', hint: 'sukut: address' },
  { key: 'district_code_field', label: 'Tuman (SOATO)', hint: 'sukut: district' },
  { key: 'region_code_field', label: 'Viloyat', hint: 'faqat SON qabul qilinadi' },
  { key: 'total_price_field', label: 'Summa', hint: 'sukut: total_price' },
  { key: 'delivery_price_field', label: 'Yetkazish narxi', hint: '' },
  { key: 'qr_code_field', label: 'QR kod', hint: 'sukut: qr_code' },
  { key: 'comment_field', label: 'Izoh', hint: 'sukut: comment' },
  { key: 'items_field', label: 'Mahsulotlar massivi', hint: 'sukut: items' },
  { key: 'item_name_field', label: 'Mahsulot nomi', hint: 'massiv ichida, sukut: name' },
  { key: 'item_qty_field', label: 'Mahsulot soni', hint: 'massiv ichida, sukut: quantity' },
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
  const current =
    value && typeof value === 'object' && !Array.isArray(value)
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
    <Form.Item label={field.label} extra={field.hint} className="md:col-span-2">
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        {MAPPING_KEYS.map((m) => (
          <Form.Item key={m.key} label={m.label} extra={m.hint}>
            <Input
              value={current[m.key] ?? ''}
              disabled={disabled}
              onChange={(e) => set(m.key, e.target.value)}
              placeholder={m.hint.replace('sukut: ', '') || undefined}
            />
          </Form.Item>
        ))}
      </div>
    </Form.Item>
  );
};

export default ConnectionFields;

const isPlainObject = (v: unknown): v is Record<string, string> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

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
      if (typeof next === 'string' && next.trim()) out[field.key] = next.trim();
      continue;
    }

    if (Array.isArray(next) || Array.isArray(prev)) {
      const a = Array.isArray(next) ? next : [];
      const b = Array.isArray(prev) ? prev : [];
      if (a.join(',') !== b.join(',')) out[field.key] = a;
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
            Object.entries(isPlainObject(v) ? v : {}).sort(([x], [y]) =>
              x.localeCompare(y),
            ),
          ),
        );
      if (norm(next) !== norm(prev)) out[field.key] = isPlainObject(next) ? next : {};
      continue;
    }

    if (typeof next === 'boolean') {
      if (next !== Boolean(prev)) out[field.key] = next;
      continue;
    }

    const a = String(next ?? '').trim();
    const b = String(prev ?? '').trim();
    if (a !== b) out[field.key] = a;
  }

  /**
   * Nuqtali kalitlar (`dispatch_config.endpoint`) ichma-ich obyektga
   * yig'iladi — backend ularni shu shaklda kutadi.
   */
  return nestPayload(out);
};
