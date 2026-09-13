import { Form, Input, Select, Switch } from 'antd';
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

export type FieldValues = Record<string, string | boolean | string[]>;

interface Props {
  fields: ConnectionField[];
  values: FieldValues;
  onChange: (key: string, value: string | boolean | string[]) => void;
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
    {fields.map((field) => {
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

export default ConnectionFields;

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

    if (typeof next === 'boolean') {
      if (next !== Boolean(prev)) out[field.key] = next;
      continue;
    }

    const a = String(next ?? '').trim();
    const b = String(prev ?? '').trim();
    if (a !== b) out[field.key] = a;
  }

  return out;
};
