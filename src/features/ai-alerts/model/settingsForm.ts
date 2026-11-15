import {
  AI_ADVISOR_RULE_KEYS,
  AI_ADVISOR_THRESHOLD_FIELDS,
  DEFAULT_RULE_LIMITS,
  THRESHOLD_FIELDS,
  isRuleKey,
  type AdvisorTranslate,
  type AiAdvisorFieldLimit,
  type AiAdvisorLimitUnit,
  type AiAdvisorRuleKey,
  type AiAdvisorRulePatch,
  type AiAdvisorSettings,
  type AiAdvisorSettingsPatch,
  type AiAdvisorThresholdField,
  type ThresholdFieldSpec,
} from "../../../entities/ai-advisor";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";

/**
 * Qoidalar sozlamasi formasi (maket `superadmin-ai-assistant-settings-rules-dialog`, tasdiq — `-settings-confirm`;
 * shartnoma §7.6–7.7, BE #644) — sof funksiyalar:
 *   `toSettingsForm`   sozlamalar → forma (yoqilgan + ko'rinadigan chegaralar matn sifatida);
 *   `validateSettingsForm` / `validateFieldInput`  `limits` bo'yicha (bo'sh, son, butun / bir kasr xona, min, max);
 *   `diffSettings`     o'zgarishlar ro'yxati (tasdiq qatorlari) + PATCH tanasi `{version, rules}` — FAQAT o'zgargan
 *                      `enabled` va chegaralar; `severity` (qotirilgan, Q1 — 400), `telegram`, `budget`, `schedule`
 *                      hech qachon yuborilmaydi (tipda ham yo'q);
 *   `rebaseSettingsForm`  server yangi versiya bersa (409 yoki qayta o'qish) — foydalanuvchi o'zgartirgan maydonlar
 *                      qoladi, tegilmaganlari yangi qiymatni oladi (boshqa oynadagi o'zgarish qaytarib yuborilmaydi);
 *   `parseServerField` 400 `INVALID_RULE {field: "rules.R1.consecutive_negative"}` → qoida va maydon.
 *
 * R8 `ratio` (Q12) va har qoidaning `telegram` kaliti formada yo'q — maketda maydon yo'q.
 */

export type RuleForm = {
  enabled: boolean;
  /** Ko'rinadigan chegaralar — kiritilgan matn (`uzs`/`days`/`count` — raqamlar, `multiplier` — «2,5»). */
  values: Partial<Record<AiAdvisorThresholdField, string>>;
};

export type SettingsForm = Record<AiAdvisorRuleKey, RuleForm>;

/** Maydon kaliti: `R1.consecutive_negative`. */
export type SettingsFieldKey = `${AiAdvisorRuleKey}.${AiAdvisorThresholdField}`;

export const settingsFieldKey = (rule: AiAdvisorRuleKey, field: AiAdvisorThresholdField): SettingsFieldKey =>
  `${rule}.${field}`;

export type SettingsFieldError =
  | { code: "required" }
  | { code: "number" }
  | { code: "integer" }
  | { code: "decimal"; digits: number }
  /** Butun son minimumdan kichik — «{min − 1} dan katta son kiriting» (maket «Noto'g'ri qiymat»). */
  | { code: "greaterThan"; value: number }
  /** Kasr son minimumdan kichik — «Kamida {min} kiriting». */
  | { code: "atLeast"; value: number }
  | { code: "atMost"; value: number }
  /** Server rad etdi, sababini mijoz topa olmadi — «{min}–{max} oralig'ida kiriting». */
  | { code: "range"; min: number; max: number };

export type SettingsErrors = Partial<Record<SettingsFieldKey, SettingsFieldError>>;

export type SettingsChange =
  | { kind: "enabled"; rule: AiAdvisorRuleKey; from: boolean; to: boolean }
  | {
      kind: "threshold";
      rule: AiAdvisorRuleKey;
      field: AiAdvisorThresholdField;
      unit: AiAdvisorLimitUnit;
      decimals: number;
      from: number;
      to: number;
    };

/** Sozlama oynasidagi maydonlar (R8 `ratio` — yashirin). */
export const editableFields = (rule: AiAdvisorRuleKey): readonly ThresholdFieldSpec[] =>
  THRESHOLD_FIELDS[rule].filter((spec) => !spec.hidden);

/** Chegara: serverdagi `limits` (bitta manba), bo'lmasa #644 zaxirasi. */
export const fieldLimit = (
  settings: Pick<AiAdvisorSettings, "limits">,
  rule: AiAdvisorRuleKey,
  field: AiAdvisorThresholdField,
): AiAdvisorFieldLimit => {
  const limit = settings.limits.rules[rule]?.[field] ?? DEFAULT_RULE_LIMITS[rule][field];
  // Har bir ko'rinadigan maydonning zaxirasi bor (`DEFAULT_RULE_LIMITS`) — bu faqat tip uchun.
  return limit ?? { min: 0, max: Number.MAX_SAFE_INTEGER, step: 1, unit: "count", default: 0 };
};

/** Kasr xonalar soni: `step` 1 → 0 (butun), 0.1 → 1. */
export const stepDecimals = (step: number): number =>
  step > 0 && step < 1 ? Math.min(6, Math.round(-Math.log10(step))) : 0;

/** Saqlangan qiymat (yo'q bo'lsa — `limits.default`). */
export const savedValue = (settings: AiAdvisorSettings, rule: AiAdvisorRuleKey, field: AiAdvisorThresholdField): number =>
  settings.rules[rule]?.[field] ?? fieldLimit(settings, rule, field).default;

/** Son → maydon matni: butun — raqamlar («50000», `TextInput` o'zi bo'ladi), kasr — til ajratkichi bilan («2,5»). */
export const formatFieldInput = (value: number, limit: AiAdvisorFieldLimit, language?: string | null): string => {
  const decimals = stepDecimals(limit.step);
  if (decimals === 0) return String(Math.round(value));
  return formatNumberLocalized(value, { language, fractionDigits: decimals });
};

export const toSettingsForm = (settings: AiAdvisorSettings, language?: string | null): SettingsForm => {
  const form = {} as SettingsForm;
  for (const rule of AI_ADVISOR_RULE_KEYS) {
    const values: RuleForm["values"] = {};
    for (const spec of editableFields(rule)) {
      values[spec.field] = formatFieldInput(savedValue(settings, rule, spec.field), fieldLimit(settings, rule, spec.field), language);
    }
    form[rule] = { enabled: settings.rules[rule]?.enabled ?? true, values };
  }
  return form;
};

/** Matn → son (bo'shliqlar olinadi, «,» va «.» — kasr). Son bo'lmasa `null`. */
const normalizeInput = (text: string): string => text.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");

export const parseFieldInput = (text: string | undefined): number | null => {
  const normalized = normalizeInput(text ?? "");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
};

/** Bitta maydon: bo'sh → son → butun / kasr xonasi → min → max. */
export const validateFieldInput = (text: string | undefined, limit: AiAdvisorFieldLimit): SettingsFieldError | null => {
  const normalized = normalizeInput(text ?? "");
  if (!normalized) return { code: "required" };
  if (!/^\d+(\.\d+)?$/.test(normalized)) return { code: "number" };
  const value = Number(normalized);
  if (!Number.isFinite(value)) return { code: "number" };
  const decimals = stepDecimals(limit.step);
  const fraction = (normalized.split(".")[1] ?? "").replace(/0+$/, "");
  if (decimals === 0 && fraction) return { code: "integer" };
  if (fraction.length > decimals) return { code: "decimal", digits: decimals };
  if (value < limit.min) return decimals === 0 ? { code: "greaterThan", value: limit.min - 1 } : { code: "atLeast", value: limit.min };
  if (value > limit.max) return { code: "atMost", value: limit.max };
  return null;
};

/** Butun forma (o'chirilgan qoidaning chegaralari ham — ular saqlanadi va qoida yoqilganda ishlaydi). */
export const validateSettingsForm = (form: SettingsForm, settings: AiAdvisorSettings): SettingsErrors => {
  const errors: SettingsErrors = {};
  for (const rule of AI_ADVISOR_RULE_KEYS) {
    for (const spec of editableFields(rule)) {
      const error = validateFieldInput(form[rule]?.values[spec.field], fieldLimit(settings, rule, spec.field));
      if (error) errors[settingsFieldKey(rule, spec.field)] = error;
    }
  }
  return errors;
};

const sameNumber = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/**
 * O'zgarishlar va PATCH tanasi (forma to'g'ri bo'lsa chaqiriladi; noto'g'ri maydon o'tkazib yuboriladi). Tartib —
 * qoidalar tartibida, qoida ichida avval kalit, keyin chegaralar. O'zgarish yo'q — `patch: null`.
 */
export const diffSettings = (
  settings: AiAdvisorSettings,
  form: SettingsForm,
): { changes: SettingsChange[]; patch: AiAdvisorSettingsPatch | null } => {
  const changes: SettingsChange[] = [];
  const rules: Partial<Record<AiAdvisorRuleKey, AiAdvisorRulePatch>> = {};
  for (const rule of AI_ADVISOR_RULE_KEYS) {
    const ruleForm = form[rule];
    if (!ruleForm) continue;
    const patch: AiAdvisorRulePatch = {};
    const wasEnabled = settings.rules[rule]?.enabled ?? true;
    if (ruleForm.enabled !== wasEnabled) {
      patch.enabled = ruleForm.enabled;
      changes.push({ kind: "enabled", rule, from: wasEnabled, to: ruleForm.enabled });
    }
    for (const spec of editableFields(rule)) {
      const limit = fieldLimit(settings, rule, spec.field);
      const next = parseFieldInput(ruleForm.values[spec.field]);
      if (next === null || validateFieldInput(ruleForm.values[spec.field], limit)) continue;
      const before = savedValue(settings, rule, spec.field);
      if (sameNumber(next, before)) continue;
      patch[spec.field] = next;
      changes.push({
        kind: "threshold",
        rule,
        field: spec.field,
        unit: limit.unit,
        decimals: stepDecimals(limit.step),
        from: before,
        to: next,
      });
    }
    if (Object.keys(patch).length) rules[rule] = patch;
  }
  return { changes, patch: changes.length ? { version: settings.version, rules } : null };
};

/**
 * Yangi server versiyasiga ko'chirish: foydalanuvchi `base` dan farqli qilgan kalit / maydon — qoladi, qolgani `next`
 * qiymatini oladi. Shu bilan 409 dan keyin boshqa superadmin o'zgartirgan, lekin bu oynada tegilmagan qiymat qayta
 * yuborilib, uning o'zgarishini bekor qilmaydi.
 */
export const rebaseSettingsForm = (
  form: SettingsForm,
  base: AiAdvisorSettings,
  next: AiAdvisorSettings,
  language?: string | null,
): SettingsForm => {
  const fresh = toSettingsForm(next, language);
  const result = {} as SettingsForm;
  for (const rule of AI_ADVISOR_RULE_KEYS) {
    const current = form[rule];
    if (!current) {
      result[rule] = fresh[rule];
      continue;
    }
    const wasEnabled = base.rules[rule]?.enabled ?? true;
    const values: RuleForm["values"] = { ...fresh[rule].values };
    for (const spec of editableFields(rule)) {
      const text = current.values[spec.field];
      const parsed = parseFieldInput(text);
      const untouched = parsed !== null && sameNumber(parsed, savedValue(base, rule, spec.field));
      if (!untouched && text !== undefined) values[spec.field] = text;
    }
    result[rule] = { enabled: current.enabled !== wasEnabled ? current.enabled : fresh[rule].enabled, values };
  }
  return result;
};

const THRESHOLD_FIELD_SET = new Set<string>(AI_ADVISOR_THRESHOLD_FIELDS);

/** `rules.R1.consecutive_negative` → `{rule: "R1", field: "consecutive_negative"}`; boshqasi — `null`. */
export const parseServerField = (
  path: string | null | undefined,
): { rule: AiAdvisorRuleKey; field: AiAdvisorThresholdField } | null => {
  const match = /^rules\.([^.]+)\.([^.]+)$/.exec(path ?? "");
  if (!match || !isRuleKey(match[1]) || !THRESHOLD_FIELD_SET.has(match[2])) return null;
  const rule = match[1];
  const field = match[2] as AiAdvisorThresholdField;
  return editableFields(rule).some((spec) => spec.field === field) ? { rule, field } : null;
};

/**
 * Server `INVALID_RULE {min, max}` → maydon xatosi: server chegaralari bilan mijoz tekshiruvi; u ham o'tkazsa —
 * «{min}–{max} oralig'ida».
 */
export const serverFieldError = (
  text: string | undefined,
  limit: AiAdvisorFieldLimit,
  server: { min: number | null; max: number | null },
): SettingsFieldError => {
  const min = server.min ?? limit.min;
  const max = server.max ?? limit.max;
  return validateFieldInput(text, { ...limit, min, max }) ?? { code: "range", min, max };
};

/** Xato matni (`aiAdvisor.settings.errors.*`; sonlar — til formatida, kasr maydonda bir xona bilan). */
export const settingsFieldErrorText = (
  error: SettingsFieldError,
  limit: AiAdvisorFieldLimit,
  t: AdvisorTranslate,
  language?: string | null,
): string => {
  const num = (value: number) => formatNumberLocalized(value, { language, fractionDigits: stepDecimals(limit.step) });
  switch (error.code) {
    case "greaterThan":
    case "atLeast":
    case "atMost":
      return t(`settings.errors.${error.code}`, { value: num(error.value) });
    case "range":
      return t("settings.errors.range", { min: num(error.min), max: num(error.max) });
    case "decimal":
      return t("settings.errors.decimal", { count: error.digits });
    default:
      return t(`settings.errors.${error.code}`);
  }
};

/**
 * Chegara qiymati matni: so'm — «50 000 so'm»; kun / ta / × — «3 kun», «3 ta», «2,5 ×» (`settings.units`). `unit:
 * false` — faqat son («50 000», «3»; R3 izohi va tasdiqdagi eski qiymat).
 */
export const formatThresholdValue = (
  value: number,
  limit: AiAdvisorFieldLimit,
  t: AdvisorTranslate,
  language?: string | null,
  { unit = true }: { unit?: boolean } = {},
): string => {
  if (limit.unit === "uzs" && unit) return formatMoneyLocalized(value, { language });
  const number = formatNumberLocalized(value, { language, fractionDigits: stepDecimals(limit.step) });
  const suffix = unit ? t(`settings.units.${limit.unit}`) : "";
  return suffix ? `${number}\u00a0${suffix}` : number;
};
