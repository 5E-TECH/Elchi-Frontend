// dizayn-v2: superadmin-ai-assistant, superadmin-ai-assistant-answering
import { useId, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Info, Send } from "lucide-react";
import { Button, Card, Field, IconButton, TextInput } from "../../../shared/ui/primitives";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";

/**
 * SAVOL YOZISH (maket: `section.el-card[aria-label="Savol yozish"]`): yashirin yorliq «Savolingiz», 52 px matn
 * maydoni (matn ko'paysa 160 px gacha o'sadi — `field-sizing: content`) + kvadrat «Yuborish» (44 px); ostida
 * «AI xato qilishi mumkin …» va hisoblagich «0 / 1000» (telefonda yashirin). Javob yozilayotganda — maydon o'chiq «Javob yozilmoqda…», tugma o'rnida ikkinchi darajali «To'xtatish»
 * (ikonkasiz — maketdagidek), izoh «To'xtatish — javob shu joyda to'xtaydi». O'chiq holatlar (AI o'chiq, oflayn,
 * limit) — maketdagi placeholder bilan. Enter — yangi qator, Ctrl/Cmd + Enter — yuborish (maket yo'q).
 */

export type ComposerBlock = "off" | "offline" | "limit" | null;

export type ComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  live: boolean;
  /** Kiritish nima uchun o'chiq (placeholder shu bo'yicha). */
  block: ComposerBlock;
  /** Holat hali kelmagan (`access/me`) — o'chiq, odatiy placeholder. */
  pending?: boolean;
  error?: string | null;
  maxLength: number;
};

const PLACEHOLDER: Record<Exclude<ComposerBlock, null>, string> = {
  off: "composer.placeholderOff",
  offline: "composer.placeholderOffline",
  limit: "composer.placeholderLimit",
};

export const Composer = ({ value, onChange, onSend, onStop, live, block, pending = false, error, maxLength }: ComposerProps) => {
  const { t } = useTranslation("aiAdvisor");
  const hintId = useId();
  const disabled = live || block !== null || pending;
  const placeholder = live ? t("composer.placeholderAnswering") : block ? t(PLACEHOLDER[block]) : t("composer.placeholder");
  const canSend = !disabled && value.trim().length > 0;

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <Card padding="none" aria-label={t("composer.sectionLabel")}>
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-end gap-2">
          <Field label={t("composer.label")} hideLabel error={error} className="min-w-0 flex-1">
            <TextInput
              multiline
              rows={1}
              value={value}
              onValueChange={onChange}
              onKeyDown={onKeyDown}
              maxLength={maxLength}
              disabled={disabled}
              placeholder={placeholder}
              aria-describedby={hintId}
              aria-keyshortcuts="Control+Enter Meta+Enter"
              className="max-h-40 min-h-[52px]! resize-none! leading-normal field-sizing-content"
            />
          </Field>
          {live ? (
            <Button variant="secondary" className="flex-none max-md:min-h-11" onClick={onStop}>
              {t("composer.stop")}
            </Button>
          ) : (
            <IconButton variant="primary" size="lg" icon={Send} label={t("composer.send")} disabled={!canSend} onClick={onSend} />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1">
          <p id={hintId} className="flex min-w-0 flex-[1_1_260px] items-start gap-1.5 text-xs text-text-muted">
            <Info size={14} aria-hidden="true" className="mt-0.5 flex-none" />
            <span>{live ? t("composer.stopHint") : t("chat.disclaimer")}</span>
          </p>
          <span aria-hidden="true" className="ml-auto text-xs text-text-muted max-md:hidden">
            {t("composer.counter", {
              count: formatNumberLocalized(value.length),
              max: formatNumberLocalized(maxLength),
            })}
          </span>
        </div>
      </div>
    </Card>
  );
};
