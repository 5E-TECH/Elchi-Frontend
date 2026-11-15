// dizayn-v2: superadmin-ai-assistant-alert-dialog, superadmin-ai-assistant-alert-dialog-receipt
import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import {
  AI_ADVISOR_NOTE_MAX,
  advisorUserName,
  isAlertOpen,
  isRuleKey,
  type AiAdvisorAlertDetail,
} from "../../../entities/ai-advisor";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { Field, TextInput } from "../../../shared/ui/primitives";

export type ResolutionNoteProps = {
  alert: AiAdvisorAlertDetail;
  value: string;
  onChange: (value: string) => void;
  /** Mijoz tekshiruvi xatosi («Izoh kamida 3 belgi bo'lsin»). */
  error?: string | null;
  /** «Hal qilindi» xatosida fokus shu maydonga. */
  inputRef?: Ref<HTMLTextAreaElement>;
  disabled?: boolean;
};

/** Qoida bo'yicha maketdagi namuna («Nima qilindi? Masalan: …»); R7 karta qoldig'i — smena naqshi. */
const placeholderKey = (alert: AiAdvisorAlertDetail): string => {
  if (!isRuleKey(alert.rule_key) || alert.facts === null) return "other";
  if (alert.rule_key === "R7" && alert.facts.source === "card_balance") return "R7card";
  return alert.rule_key;
};

/**
 * Izoh (D8, D9; maket `superadmin-ai-assistant-alert-dialog`):
 *   ochiq   — «Izoh» maydoni (3 qator, ≤ 500), «"Hal qilindi" uchun majburiy · 3–500 belgi · faoliyat jurnaliga
 *             yoziladi»; xato — «Izoh kamida 3 belgi bo'lsin» (ko'rsatma o'rnida);
 *   yopilgan — «Shodiyor Ergashev · Bugun, 15:10» + izoh matni (`sunken` quti; «Hal qilindi» yoki «Ahamiyatsiz»).
 */
export const ResolutionNote = ({ alert, value, onChange, error, inputRef, disabled }: ResolutionNoteProps) => {
  const { t, i18n } = useTranslation("aiAdvisor");
  const language = i18n.resolvedLanguage ?? i18n.language;

  if (!isAlertOpen(alert.status)) {
    const by = advisorUserName(alert.resolved_by);
    const at = alert.resolved_at ? formatDateTimeLocalized(alert.resolved_at, { language }) : "";
    const meta = by && at ? t("alerts.dialog.closedBy", { name: by, at }) : by || at;
    if (!meta && !alert.resolution_note) return null;
    return (
      <div data-testid="ai-alert-resolution" className="flex flex-col gap-1 rounded-xl bg-sunken px-3.5 py-3">
        {meta ? <span className="text-xs text-text-muted">{meta}</span> : null}
        {alert.resolution_note ? (
          <p className="m-0 text-[13px] whitespace-pre-line [overflow-wrap:anywhere] text-text">{alert.resolution_note}</p>
        ) : null}
      </div>
    );
  }

  const amount =
    alert.facts !== null && alert.rule_key === "R4" ? formatMoneyLocalized(alert.facts.debt, { language }) : "";

  return (
    <Field label={t("alerts.note.label")} hint={t("alerts.note.hint")} error={error ?? undefined}>
      <TextInput
        multiline
        ref={inputRef}
        rows={3}
        maxLength={AI_ADVISOR_NOTE_MAX}
        value={value}
        disabled={disabled}
        placeholder={t(`alerts.note.placeholder.${placeholderKey(alert)}`, { amount })}
        onValueChange={onChange}
      />
    </Field>
  );
};
