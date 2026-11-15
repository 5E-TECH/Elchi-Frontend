// dizayn-v2: superadmin-ai-assistant-settings-rules-dialog
import { useId } from "react";
import { useTranslation } from "react-i18next";
import type {
  AdvisorTranslate,
  AiAdvisorRuleKey,
  AiAdvisorSettings,
  AiAdvisorThresholdField,
  ThresholdFieldSpec,
} from "../../../entities/ai-advisor";
import { cx } from "../../../shared/lib/cx";
import { Field, Pressable, TextInput } from "../../../shared/ui/primitives";
import {
  editableFields,
  fieldLimit,
  formatThresholdValue,
  parseFieldInput,
  savedValue,
  settingsFieldErrorText,
  settingsFieldKey,
  stepDecimals,
  type RuleForm,
  type SettingsErrors,
  type SettingsFieldKey,
} from "../model/settingsForm";

export type RuleSettingsRowProps = {
  rule: AiAdvisorRuleKey;
  /** Saqlangan sozlamalar — «Avval: …» va «avval yoqilgan edi» shundan. */
  settings: AiAdvisorSettings;
  value: RuleForm;
  errors: SettingsErrors;
  disabled?: boolean;
  onToggle: (rule: AiAdvisorRuleKey, enabled: boolean) => void;
  onFieldChange: (rule: AiAdvisorRuleKey, field: AiAdvisorThresholdField, text: string) => void;
  /** Xato maydonga fokus berish uchun (`RulesSettingsDialog`). */
  registerInput: (key: SettingsFieldKey, element: HTMLInputElement | null) => void;
};

/**
 * Bitta qoida qatori (maket `superadmin-ai-assistant-settings-rules-dialog`): nomi (qalin) + izoh (13 px) va o'ngda
 * kalit (`.el-switch` — `Pressable role="switch"`, nomi `aria-labelledby`, izohi `aria-describedby`; telefonda bosish
 * maydoni 44 px), ostida chegaralar to'ri (`minmax(190px, 1fr)`, telefonda bitta ustun).
 *
 * Maydonlar: so'm — `TextInput mode="money"` (mingliklar, valyuta o'ngda); kun / ta — `mode="number"` + qo'shimcha;
 * R3 ko'paytiruvchi — `inputMode="decimal"` + «×». Ko'rsatma: o'zgargan bo'lsa «Avval: 50 000 so'm»; doimiy izohli
 * maydonda (R3 «Mediana + 3 × mediana og'ishi» — joriy qiymat bilan, R4 «Qarz bo'lsa») — «… · avval 7 kun». Kalit
 * saqlangandan farqli bo'lsa izohga « · avval yoqilgan edi / o'chirilgan edi» (maketdagi R8).
 */
export const RuleSettingsRow = ({
  rule,
  settings,
  value,
  errors,
  disabled,
  onToggle,
  onFieldChange,
  registerInput,
}: RuleSettingsRowProps) => {
  const { t, i18n } = useTranslation("aiAdvisor");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const tt = t as unknown as AdvisorTranslate;
  const nameId = useId();
  const descriptionId = useId();
  const fields = editableFields(rule);

  const wasEnabled = settings.rules[rule]?.enabled ?? true;
  const ratio = formatThresholdValue(savedValue(settings, "R8", "ratio"), fieldLimit(settings, "R8", "ratio"), tt, language, {
    unit: false,
  });
  const description = t(`rules.${rule}.description`, { ratio });
  const toggled = value.enabled !== wasEnabled;

  const fieldHint = (spec: ThresholdFieldSpec) => {
    const limit = fieldLimit(settings, rule, spec.field);
    const before = savedValue(settings, rule, spec.field);
    const current = parseFieldInput(value.values[spec.field]);
    const changed = current === null || Math.abs(current - before) > 1e-9;
    const shown = current ?? before;
    const staticHint = spec.hintKey
      ? t(spec.hintKey, { value: formatThresholdValue(shown, limit, tt, language, { unit: false }) })
      : null;
    const beforeText = formatThresholdValue(before, limit, tt, language);
    if (!changed) return staticHint ?? undefined;
    return staticHint ? `${staticHint} · ${t("settings.beforeInline", { value: beforeText })}` : t("settings.before", { value: beforeText });
  };

  return (
    <li className="flex flex-col gap-3 border-t border-border py-3.5">
      <div className="flex items-center gap-4">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span id={nameId} className="text-sm font-semibold text-text">
            {t(`rules.${rule}.name`)}
          </span>
          <span id={descriptionId} className="text-[13px] text-text-muted">
            {description}
            {toggled ? ` · ${t(wasEnabled ? "settings.wasEnabled" : "settings.wasDisabled")}` : null}
          </span>
        </span>
        <Pressable
          role="switch"
          aria-checked={value.enabled}
          aria-labelledby={nameId}
          aria-describedby={descriptionId}
          disabled={disabled}
          onClick={() => onToggle(rule, !value.enabled)}
          className="group inline-flex shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed max-md:-mr-1 max-md:min-h-11 max-md:min-w-11"
        >
          <span
            aria-hidden="true"
            className={cx(
              "relative h-5 w-9 rounded-full bg-border-strong transition-colors duration-150 motion-reduce:transition-none",
              "group-aria-checked:bg-action group-disabled:opacity-45",
            )}
          >
            <span className="absolute top-0.5 left-0.5 size-4 rounded-full bg-on-solid transition-transform duration-150 group-aria-checked:translate-x-4 motion-reduce:transition-none" />
          </span>
        </Pressable>
      </div>

      {fields.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(190px,100%),1fr))] gap-x-4 gap-y-3">
          {fields.map((spec) => {
            const key = settingsFieldKey(rule, spec.field);
            const limit = fieldLimit(settings, rule, spec.field);
            const error = errors[key];
            const text = value.values[spec.field] ?? "";
            const common = {
              value: text,
              autoComplete: "off",
              disabled,
              ref: (element: HTMLInputElement | null) => registerInput(key, element),
              onValueChange: (next: string) => onFieldChange(rule, spec.field, next),
            } as const;
            const unitText = t(`settings.units.${limit.unit}`);
            return (
              <Field
                key={spec.field}
                label={t(spec.labelKey)}
                hint={fieldHint(spec)}
                error={error ? settingsFieldErrorText(error, limit, tt, language) : undefined}
              >
                {limit.unit === "uzs" ? (
                  <TextInput mode="money" {...common} />
                ) : stepDecimals(limit.step) > 0 ? (
                  <TextInput {...common} inputMode="decimal" suffix={unitText || null} />
                ) : (
                  <TextInput mode="number" {...common} suffix={unitText || null} />
                )}
              </Field>
            );
          })}
        </div>
      ) : null}
    </li>
  );
};
