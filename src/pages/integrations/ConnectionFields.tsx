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

const LABEL_CLS =
  'text-[11px] font-bold uppercase tracking-[0.16em] text-maindark/50 dark:text-primary/50';
const INPUT_CLS =
  'w-full rounded-2xl border border-[color:var(--color-border-soft)] bg-white px-4 py-3 text-sm font-semibold text-maindark outline-none transition focus:border-main dark:bg-white/[0.04] dark:text-white';
const HINT_CLS =
  'block text-[11px] text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]';

export type FieldValues = Record<string, string | boolean | string[]>;

interface Props {
  fields: ConnectionField[];
  values: FieldValues;
  onChange: (key: string, value: string | boolean | string[]) => void;
  /** Tahrirlashda sir maydonlari bo'sh ko'rinadi — bu ATAYLAB (pastga qara). */
  disabled?: boolean;
}

const ConnectionFields = ({ fields, values, onChange, disabled }: Props) => (
  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
    {fields.map((field) => {
      const raw = values[field.key];

      if (field.type === 'switch') {
        return (
          <label
            key={field.key}
            className="flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--color-border-soft)] px-4 py-3 md:col-span-2"
          >
            <span>
              <span className={LABEL_CLS}>{field.label}</span>
              {field.hint && (
                <span className={`${HINT_CLS} mt-0.5`}>{field.hint}</span>
              )}
            </span>
            <input
              type="checkbox"
              checked={Boolean(raw)}
              disabled={disabled}
              onChange={(e) => onChange(field.key, e.target.checked)}
              className="h-5 w-5 accent-[color:var(--color-main)]"
            />
          </label>
        );
      }

      if (field.type === 'select') {
        return (
          <label key={field.key} className="flex flex-col gap-1.5">
            <span className={LABEL_CLS}>{field.label}</span>
            <select
              value={String(raw ?? '')}
              disabled={disabled}
              onChange={(e) => onChange(field.key, e.target.value)}
              className={INPUT_CLS}
            >
              {(field.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {field.hint && <span className={HINT_CLS}>{field.hint}</span>}
          </label>
        );
      }

      if (field.type === 'tags') {
        /**
         * Vergul/yangi qatordan ajratilgan ro'yxat. Alohida "tag" komponenti
         * ATAYLAB ishlatilmadi: IP ro'yxatini nusxa-joylash (bir necha manzil
         * birga) eng ko'p uchraydigan holat va oddiy matn maydoni buni
         * tabiiy qo'llaydi.
         */
        const text = Array.isArray(raw) ? raw.join(', ') : String(raw ?? '');
        return (
          <label key={field.key} className="flex flex-col gap-1.5 md:col-span-2">
            <span className={LABEL_CLS}>{field.label}</span>
            <input
              value={text}
              disabled={disabled}
              placeholder={field.placeholder}
              onChange={(e) =>
                onChange(
                  field.key,
                  e.target.value
                    .split(/[,\n]/)
                    .map((v) => v.trim())
                    .filter(Boolean),
                )
              }
              className={INPUT_CLS}
            />
            {field.hint && <span className={HINT_CLS}>{field.hint}</span>}
          </label>
        );
      }

      const isSecret = field.type === 'secret';
      return (
        <label
          key={field.key}
          className={`flex flex-col gap-1.5 ${
            field.type === 'url' ? 'md:col-span-2' : ''
          }`}
        >
          <span className={LABEL_CLS}>{field.label}</span>
          <input
            type={isSecret ? 'password' : 'text'}
            value={String(raw ?? '')}
            disabled={disabled}
            placeholder={field.placeholder}
            autoComplete={isSecret ? 'new-password' : 'off'}
            onChange={(e) => onChange(field.key, e.target.value)}
            className={INPUT_CLS}
          />
          {field.hint && <span className={HINT_CLS}>{field.hint}</span>}
        </label>
      );
    })}
  </div>
);

export default ConnectionFields;

/**
 * Saqlash uchun yukni yasaydi — FAQAT o'zgargan maydonlar.
 *
 * ⚠️ Bu qoida buzilmasligi kerak. Backendda "berilmasa tegilmaydi" mantiqi
 * bor: sir maydoni bo'sh yuborilsa, ishlab turgan kalit O'CHIB KETARDI.
 * Tahrirlashda sirlar bo'sh ko'rinadi (server ularni qaytarmaydi), shuning
 * uchun ular faqat operator YANGI qiymat yozgandagina yuboriladi.
 */
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
