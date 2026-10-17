// dizayn-v2: superadmin-integrations-panel-settings, superadmin-integrations-marketplace-console, superadmin-integrations-wizard, admin-integrations-conn-settings
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMarkets } from "../../entities/markets";
import { cx } from "../../shared/lib/cx";
import { Field, Select, TextInput, type SelectOption } from "../../shared/ui/primitives";
import { isFieldDisabled, visibleFields } from "./connections";
import { nestPayload } from "./fieldPath";
import type { ConnectionField } from "./connections";
import StatusMapField from "./StatusMapField";
import type { StatusMapValue } from "./statusMap";
import { SecretInput, Switch, TagsInput } from "./ui";

/**
 * UMUMIY ULANISH FORMASI — maydon ro'yxatidan o'zini yasaydi (dizayn v2: `Field` + `TextInput` /
 * `Select`, kalit — `Switch`, IP ro'yxati — chiplar).
 *
 * NEGA UMUMIY. Foydalanuvchi talabi: «Marketplacelar bilan ulashlar, va boshqa tizimlar bilan ulashni
 * ham deyarli bir xil UI da qil, faqat so'raydigan va ulaydigan qiymatlari farqli bo'lsa faqat shular
 * boshqa bo'lsin». Forma BITTA, farq faqat `connections.ts` dagi maydon ro'yxatida.
 */

/**
 * Maydon qiymatlari. `Record<string, string>` — `mapping` turi uchun (kalit→qiymat xaritasi).
 * Boshqa turlar satr/mantiq/massiv ishlatadi.
 */
export type FieldValue = string | boolean | string[] | Record<string, string> | StatusMapValue;

export type FieldValues = Record<string, FieldValue>;

interface Props {
  fields: ConnectionField[];
  values: FieldValues;
  onChange: (key: string, value: FieldValue) => void;
  /** Tahrirlashda sir maydonlari bo'sh ko'rinadi — bu ATAYLAB (pastga qara). */
  disabled?: boolean;
  /** Maydon yonidagi qo'shimcha (masalan webhook manzili yonida «Sinash» tugmasi). */
  renderAddon?: (field: ConnectionField) => ReactNode;
  /** Maydon ostidagi qo'shimcha (masalan sinov natijasi). */
  renderAfter?: (field: ConnectionField) => ReactNode;
  /** Ustunlar: sukut — ≥ 768 da ikki ustun. */
  columns?: 1 | 2;
  /** Majburiy deb belgilanadigan maydonlar (yorliqda «*»), masalan ustada «Nomi». Tekshiruvni chaqiruvchi qiladi. */
  requiredKeys?: readonly string[];
}

const WIDE = "md:col-span-2";

const ConnectionFields = ({ fields, values, onChange, disabled, renderAddon, renderAfter, columns = 2, requiredKeys }: Props) => {
  const { t } = useTranslation("integrations");
  const hintOf = (field: ConnectionField) => (field.hintKey ? t(field.hintKey) : undefined);
  const placeholderOf = (field: ConnectionField) => (field.placeholderKey ? t(field.placeholderKey) : field.placeholder);

  return (
    <div className={cx("grid grid-cols-1 gap-x-4 gap-y-4", columns === 2 && "md:grid-cols-2")}>
      {/*
        Shartli maydonlar yashiriladi: `auth_type` «API kalit» bo'lsa login/parol keraksiz (audit FE-07).
      */}
      {visibleFields(fields, values).map((field) => {
        const raw = values[field.key];
        /**
         * ⚠️ `disabled` IKKI manbadan: forma saqlanayotgan bo'lsa hammasi, yoki maydonning O'ZI shartli
         * o'chirilgan bo'lsa (`disabledWhen`) — masalan sinov manzili: kalit o'chirilganda qiymat KO'RINISHI
         * kerak, aks holda operator nima sozlanganini bilmaydi.
         */
        const fieldDisabled = disabled || isFieldDisabled(field, values);
        const addon = renderAddon?.(field);
        const after = renderAfter?.(field);

        /* ── Kalit/o'chirgich ── */
        if (field.type === "switch") {
          return (
            <div key={field.key} className={WIDE}>
              <Switch
                checked={Boolean(raw)}
                disabled={fieldDisabled}
                onChange={(checked) => onChange(field.key, checked)}
                label={t(field.labelKey)}
                description={hintOf(field)}
              />
            </div>
          );
        }

        /* ── Tanlov ── */
        if (field.type === "select") {
          const options: SelectOption[] = (field.options ?? []).map((o) => ({
            value: o.value,
            label: "labelKey" in o ? t(o.labelKey) : o.label,
          }));
          return (
            <Field key={field.key} label={t(field.labelKey)} hint={hintOf(field)} labelAs="span" disabled={fieldDisabled}>
              <Select
                options={options}
                value={String(raw ?? "") || null}
                onChange={(v) => onChange(field.key, v ?? "")}
                placeholder={placeholderOf(field)}
                disabled={fieldDisabled}
              />
            </Field>
          );
        }

        /* ── Ro'yxat (IP va h.k.) ── */
        if (field.type === "tags") {
          return (
            <Field key={field.key} label={t(field.labelKey)} hint={hintOf(field)} className={WIDE} disabled={fieldDisabled}>
              <TagsInput
                value={Array.isArray(raw) ? (raw as string[]) : []}
                onChange={(v) => onChange(field.key, v)}
                placeholder={placeholderOf(field)}
                disabled={fieldDisabled}
                listLabel={t("console.ipListLabel")}
                removeLabel={(item) => t("console.ipRemove", { ip: item })}
              />
            </Field>
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

        /* ── Status xaritasi (kanonik katalogdan jadval) ── */
        if (field.type === "status-map") {
          return (
            <div key={field.key} className={cx("min-w-0", WIDE)}>
              <StatusMapField
                field={field}
                kind={field.statusMapKind ?? "outbound"}
                value={raw}
                disabled={fieldDisabled}
                onChange={(v) => onChange(field.key, v)}
              />
            </div>
          );
        }

        /* ── Maydon xaritasi (JSON) ── */
        if (field.type === "mapping") {
          return (
            <div key={field.key} className={cx("min-w-0", WIDE)}>
              <MappingField field={field} value={raw} disabled={fieldDisabled} onChange={(v) => onChange(field.key, v)} />
            </div>
          );
        }

        /* ── Sir ── */
        if (field.type === "secret") {
          return (
            /**
             * ⚠️ Sir maydoni BO'SH boshlanadi va bu ataylab: server uni qaytarmaydi (faqat shifrlangan
             * holda saqlanadi). Bo'sh qoldirilsa `buildChangedPayload` uni YUBORMAYDI — ishlab turgan kalit
             * saqlanadi. Izoh shuni aytib turadi, aks holda operator «kalit yo'qolgan» deb o'ylardi.
             */
            <Field key={field.key} label={t(field.labelKey)} hint={hintOf(field)} disabled={fieldDisabled} required={requiredKeys?.includes(field.key)}>
              <SecretInput
                value={String(raw ?? "")}
                onValueChange={(v) => onChange(field.key, v)}
                placeholder={t("fldSecretUntouched")}
                disabled={fieldDisabled}
              />
            </Field>
          );
        }

        /* ── Matn / manzil ── */
        const input = (
          <TextInput
            value={String(raw ?? "")}
            onValueChange={(v) => onChange(field.key, v)}
            placeholder={placeholderOf(field)}
            disabled={fieldDisabled}
            type={field.type === "url" ? "url" : "text"}
            inputMode={field.type === "url" ? "url" : undefined}
          />
        );
        return (
          <div key={field.key} className={cx("flex min-w-0 flex-col gap-3", addon || after ? WIDE : undefined)}>
            <Field label={t(field.labelKey)} hint={hintOf(field)} disabled={fieldDisabled} required={requiredKeys?.includes(field.key)}>
              {addon ? (
                <div className="flex min-w-0 items-start gap-2 max-md:flex-col max-md:items-stretch">
                  <div className="min-w-0 flex-1">{input}</div>
                  {addon}
                </div>
              ) : (
                input
              )}
            </Field>
            {after}
          </div>
        );
      })}
    </div>
  );
};

/** Market javobidan ro'yxatni ajratadi — marshrutga qarab qobiq farq qiladi. */
const marketList = (raw: unknown): Array<Record<string, unknown>> => {
  const data = (raw as { data?: { items?: unknown[] } | unknown[] } | undefined)?.data;
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  if (Array.isArray((data as { items?: unknown[] } | undefined)?.items)) {
    return (data as { items: unknown[] }).items as Array<Record<string, unknown>>;
  }
  return [];
};

/**
 * Market tanlagichi — ro'yxat API'dan yuklanadi.
 *
 * ⚠️ QIYMAT SATR bo'lib qoladi (`market_id` bigint). Songa aylantirmaymiz: JS `number` katta bigint'ni
 * aniq saqlamaydi va id buzilib ketardi.
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
  const options: SelectOption[] = marketList(query.data).map((m) => ({
    value: String(m.id),
    label: String(m.name ?? m.username ?? `#${m.id}`),
  }));

  return (
    <Field
      label={t(field.labelKey)}
      hint={query.isError ? t("fldListFailed") : field.hintKey ? t(field.hintKey) : undefined}
      labelAs="span"
      disabled={disabled}
    >
      <Select
        searchable
        clearable
        options={options}
        value={value || null}
        onChange={(v) => onChange(v ?? "")}
        loading={query.isLoading}
        placeholder={t("fldPickMarket")}
        disabled={disabled}
      />
    </Field>
  );
};

/**
 * MAYDON XARITASI — kalit→qiymat juftliklari.
 *
 * ⚠️ XOM JSON MAYDONI EMAS: bitta vergul yoki qavs xatosi butun sozlamani buzardi. Shu bois tayyor
 * kalitlar ro'yxati va har biriga matn maydoni. Kalitlar backend o'qiydigan nomlar bilan AYNAN bir xil
 * (`order-lifecycle.service.ts` → `fieldMapping.*`).
 *
 * ⚠️ `def` — backend sukut bo'yicha o'qiydigan maydon nomi, MATNDAN AJRATILGAN.
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
  const current = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, string>) : {};

  const set = (key: string, next: string) => {
    const out = { ...current };
    // Bo'sh qiymat XARITADAN OLINADI — bo'sh satr backendni «maydon bor, lekin nomi yo'q» holatiga tushirardi.
    if (next.trim()) out[key] = next.trim();
    else delete out[key];
    onChange(out);
  };

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
      <legend className="mb-1 flex flex-col gap-0.5 p-0">
        <span className="text-sm font-semibold text-text">{t(field.labelKey)}</span>
        {field.hintKey ? <span className="text-[13px] leading-[18px] text-text-muted">{t(field.hintKey)}</span> : null}
      </legend>
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
        {MAPPING_KEYS.map((m) => (
          <Field
            key={m.key}
            label={t(m.labelKey)}
            hint={
              m.hintKey
                ? t(m.hintKey)
                : m.def
                  ? t(m.inArray ? "mapDefaultInArray" : "mapDefault", { name: m.def })
                  : undefined
            }
            disabled={disabled}
          >
            <TextInput
              value={current[m.key] ?? ""}
              onValueChange={(v) => set(m.key, v)}
              placeholder={m.def ?? t("stlNotePlaceholder")}
              disabled={disabled}
            />
          </Field>
        ))}
      </div>
    </fieldset>
  );
};

export default ConnectionFields;


const isPlainObject = (v: unknown): v is Record<string, unknown> =>
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
      out[field.key] =
        value ??
        (field.type === "tags"
          ? []
          : field.type === "switch"
            ? false
            : field.type === "mapping" || field.type === "status-map"
              ? {}
              : "");
    }
  }

  /**
   * Nuqtali kalitlar (`dispatch_config.endpoint`) ichma-ich obyektga
   * yig'iladi — backend ularni shu shaklda kutadi.
   */
  return nestPayload(out);
};
