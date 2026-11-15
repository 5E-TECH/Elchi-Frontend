// dizayn-v2: superadmin-ai-assistant-settings-rules-dialog, superadmin-ai-assistant-settings-confirm
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, Settings } from "lucide-react";
import {
  AI_ADVISOR_ERROR_CODES,
  AI_ADVISOR_RULE_KEYS,
  readAdvisorError,
  ruleName,
  useAdvisorSettings,
  type AdvisorTranslate,
  type AiAdvisorRuleKey,
  type AiAdvisorSettings,
  type AiAdvisorThresholdField,
} from "../../../entities/ai-advisor";
import { NoticeAlert } from "../../../entities/notification/ui/NoticeAlert";
import { notify } from "../../../shared/lib/notify";
import { Button, Dialog, SkeletonLines, useConfirm, type ConfirmRow } from "../../../shared/ui/primitives";
import {
  diffSettings,
  editableFields,
  fieldLimit,
  formatThresholdValue,
  parseServerField,
  rebaseSettingsForm,
  serverFieldError,
  settingsFieldKey,
  toSettingsForm,
  validateSettingsForm,
  type SettingsChange,
  type SettingsErrors,
  type SettingsFieldKey,
  type SettingsForm,
} from "../model/settingsForm";
import { useSaveAdvisorSettings } from "../model/useSaveAdvisorSettings";
import { RuleSettingsRow } from "./RuleSettingsRow";

/** Maket 720 px; `Dialog` ning eng kattasi (xl) 640 — kengaytiriladi (D6, ogohlantirish oynasidagidek). */
const WIDE = "md:max-w-[720px]";

type Notice = "failed" | "conflict" | null;

export type RulesSettingsDialogProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  QOIDALAR SOZLAMASI — maket `superadmin-ai-assistant-settings-rules-dialog` (+ «Boshqa holatlar»), tasdiq —
 *  `-settings-confirm` (faqat qoida qatorlari)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  D3: faqat «Qoidalar» qismi — ichki tablar («Hisobotlar», «Budjet», «Bilim bazasi») yo'q: `telegram`, `budget`,
 *  `schedule` hozircha `null`. R8 `ratio` (Q12) va har qoidaning Telegram kaliti — maketda yo'q, chizilmaydi.
 *  `severity` qotirilgan (#644) — yuborilmaydi.
 *
 *  Oqim: ochilganda sozlamalar qayta o'qiladi (forma keshdagidan boshlanadi; yangi versiya kelsa — `rebase`) →
 *  «Saqlash»: mijoz tekshiruvi (`limits`; birinchi xato maydonga fokus) → o'zgarish yo'q — oyna yopiladi → tasdiq
 *  (`useConfirm`: «Sozlamalarni saqlaysizmi?», «N ta o'zgarish · …», «qoida · maydon: eski → yangi», o'chirilgan
 *  qoida bo'lsa izoh; `onConfirm` siz) → PATCH shu oynada («Saqlash» yuklanishda, Esc/fon yopmaydi):
 *    200 — oyna yopiladi, toast «Sozlamalar saqlandi / Qoidalar keyingi tekshiruvdan qo'llanadi»;
 *    400 `INVALID_RULE {field, min, max}` — o'sha maydonda xato, fokus;
 *    409 `SETTINGS_CONFLICT` — sozlamalar qayta o'qiladi, o'zgarishlar yangi versiyaga ko'chiriladi, info izoh (maket
 *        yo'q — eng yaqini «Saqlab bo'lmadi»);
 *    boshqa — danger «Sozlamalar saqlanmadi / Hech narsa o'zgarmadi — qayta urining.».
 */
export const RulesSettingsDialog = ({ open, onClose }: RulesSettingsDialogProps) => {
  const { t, i18n } = useTranslation("aiAdvisor");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const tt = t as unknown as AdvisorTranslate;
  const confirm = useConfirm();
  const query = useAdvisorSettings({ enabled: open });
  const settings = query.data?.kind === "available" ? query.data.data : null;
  const save = useSaveAdvisorSettings();
  const saving = save.isPending;

  const [base, setBase] = useState<AiAdvisorSettings | null>(null);
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [wasOpen, setWasOpen] = useState(false);

  // Ochilganda — keshdagi sozlamalardan toza forma.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setBase(settings);
      setForm(settings ? toSettingsForm(settings, language) : null);
      setErrors({});
      setNotice(null);
    }
  }
  // Server yangi versiya berdi (ochilishdagi qayta o'qish, 409) — tegilmagan maydonlar yangilanadi.
  else if (open && settings && settings !== base) {
    setBase(settings);
    setForm(form && base ? rebaseSettingsForm(form, base, settings, language) : toSettingsForm(settings, language));
  }

  // Ochilganda qayta o'qish (boshqa oynada o'zgargan bo'lishi mumkin).
  // `cancelRefetch: false` — kuzatuvchi o'zi so'rov boshlagan bo'lsa, ikkinchisi ketmaydi.
  const { refetch } = query;
  useEffect(() => {
    if (open) void refetch({ cancelRefetch: false });
  }, [open, refetch]);

  const inputs = useRef(new Map<SettingsFieldKey, HTMLInputElement>());
  const registerInput = useCallback((key: SettingsFieldKey, element: HTMLInputElement | null) => {
    if (element) inputs.current.set(key, element);
    else inputs.current.delete(key);
  }, []);
  const focusField = (key: SettingsFieldKey) => {
    const element = inputs.current.get(key);
    element?.focus();
    element?.scrollIntoView?.({ block: "nearest" });
  };

  const noticeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (notice) noticeRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [notice]);

  const clearError = (key: SettingsFieldKey) =>
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });

  const onToggle = (rule: AiAdvisorRuleKey, enabled: boolean) =>
    setForm((current) => (current ? { ...current, [rule]: { ...current[rule], enabled } } : current));

  const onFieldChange = (rule: AiAdvisorRuleKey, field: AiAdvisorThresholdField, text: string) => {
    setForm((current) =>
      current ? { ...current, [rule]: { ...current[rule], values: { ...current[rule].values, [field]: text } } } : current,
    );
    clearError(settingsFieldKey(rule, field));
  };

  const changeRow = (change: SettingsChange): ConfirmRow => {
    const name = ruleName(change.rule, tt);
    const arrow = (from: string, to: string) => (
      <span className="inline-flex flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5">
        <span className="font-normal text-text-muted">{from}</span>
        <ArrowRight aria-hidden="true" size={16} className="shrink-0 text-text-muted" />
        <span className="sr-only"> {t("settings.confirm.newValue")} </span>
        <span>{to}</span>
      </span>
    );
    if (change.kind === "enabled") {
      const label = (enabled: boolean) => t(enabled ? "settings.enabled" : "settings.disabled");
      return { label: name, value: arrow(label(change.from), label(change.to)) };
    }
    const limit = base ? fieldLimit(base, change.rule, change.field) : null;
    const spec = editableFields(change.rule).find((item) => item.field === change.field);
    const format = (value: number, unit: boolean) =>
      limit ? formatThresholdValue(value, limit, tt, language, { unit }) : String(value);
    return {
      label: t("settings.confirm.fieldRow", { rule: name, field: spec ? t(spec.labelKey) : change.field }),
      value: arrow(format(change.from, false), format(change.to, true)),
    };
  };

  const submit = async () => {
    if (!base || !form || saving) return;
    setNotice(null);
    const nextErrors = validateSettingsForm(form, base);
    setErrors(nextErrors);
    const firstInvalid = AI_ADVISOR_RULE_KEYS.flatMap((rule) =>
      editableFields(rule, base).map((spec) => settingsFieldKey(rule, spec.field)),
    ).find((key) => nextErrors[key]);
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }
    const { changes, patch } = diffSettings(base, form);
    if (!patch) {
      onClose();
      return;
    }
    const disabling = changes.some((change) => change.kind === "enabled" && !change.to);
    const confirmed = await confirm({
      title: t("settings.confirm.title"),
      description: t("settings.confirm.description", { count: changes.length }),
      icon: Settings,
      iconTone: "neutral",
      rows: changes.map(changeRow),
      note: disabling ? t("settings.confirm.disabledNote") : undefined,
      confirmLabel: t("settings.confirm.save"),
      confirmIcon: Check,
      cancelLabel: t("settings.confirm.back"),
    });
    if (!confirmed) return;
    try {
      await save.mutateAsync(patch);
      notify.success(t("settings.saved.title"), { description: t("settings.saved.text") });
      onClose();
    } catch (error) {
      const { status, code, fields } = readAdvisorError(error);
      const target = code === AI_ADVISOR_ERROR_CODES.INVALID_RULE ? parseServerField(fields.field) : null;
      if (target) {
        const key = settingsFieldKey(target.rule, target.field);
        setErrors((current) => ({
          ...current,
          [key]: serverFieldError(form[target.rule].values[target.field], fieldLimit(base, target.rule, target.field), fields),
        }));
        focusField(key);
        return;
      }
      if (status === 409) {
        // `useSaveAdvisorSettings` sozlamalarni eskirtirdi — yangi versiya kelganda forma `rebase` qilinadi.
        setNotice("conflict");
        return;
      }
      setNotice("failed");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      className={WIDE}
      icon={Settings}
      title={t("settings.title")}
      description={t("settings.description")}
      busy={saving}
      initialFocus="panel"
      data-testid="ai-advisor-settings-dialog"
      footer={
        <>
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            {t("settings.cancel")}
          </Button>
          <Button
            leftIcon={Check}
            loading={saving}
            loadingText={t("settings.saving")}
            disabled={!form}
            onClick={() => void submit()}
          >
            {t("settings.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="m-0 text-[13px] text-text-muted">{t("settings.intro")}</p>
        {base && form ? (
          <ul aria-label={t("settings.rulesLabel")} className="m-0 flex list-none flex-col p-0">
            {AI_ADVISOR_RULE_KEYS.map((rule) => (
              <RuleSettingsRow
                key={rule}
                rule={rule}
                settings={base}
                value={form[rule]}
                errors={errors}
                onToggle={onToggle}
                onFieldChange={onFieldChange}
                registerInput={registerInput}
              />
            ))}
          </ul>
        ) : (
          // `QueryBoundary` emas (asosli istisno): oyna faqat sozlamalar zondi muvaffaqiyatli bo'lganda ochiladi —
          // ma'lumot keshda, bo'sh / xato holati yo'q; bu yerda faqat qisqa yuklanish skeleti (saqlash xatosi —
          // pastdagi `NoticeAlert`).
          <div role="status" aria-label={t("settings.rulesLabel")} className="flex flex-col gap-4">
            <SkeletonLines lines={3} />
            <SkeletonLines lines={3} />
          </div>
        )}
        {notice ? (
          <div ref={noticeRef}>
            {notice === "conflict" ? (
              <NoticeAlert tone="info" title={t("settings.conflict.title")}>
                {t("settings.conflict.text")}
              </NoticeAlert>
            ) : (
              <NoticeAlert tone="danger" title={t("settings.failed.title")}>
                {t("settings.failed.text")}
              </NoticeAlert>
            )}
          </div>
        ) : null}
      </div>
    </Dialog>
  );
};

export default RulesSettingsDialog;
