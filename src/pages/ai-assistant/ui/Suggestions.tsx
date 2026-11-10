// dizayn-v2: superadmin-ai-assistant, superadmin-ai-assistant-empty
import { useId, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { EmptyState, Pressable } from "../../../shared/ui/primitives";
import { cx } from "../../../shared/lib/cx";
import { cardSuggestions, chipSuggestions } from "../model/suggestions";

/**
 * Tavsiya savollar: suhbat ostida 5 chip (`.el-chip` — amal tugmasi, `aria-pressed` YO'Q; telefonda o'z
 * konteynerida gorizontal suriladi), bo'sh suhbatda — salomlashuv + 6 tanlov kartasi (`.el-choice-card`).
 * Bosilsa savol darhol yuboriladi.
 */

/** CODE-MAP `.el-chip` retsepti (telefonda 44 px). */
const CHIP =
  "inline-flex h-8 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border border-border-strong bg-surface px-3 " +
  "text-[13px] font-medium text-text hover:border-text-subtle disabled:cursor-not-allowed disabled:opacity-45 max-md:h-11";

/** CODE-MAP `.el-choice-card` retsepti (tanlov emas — amal, shuning uchun `has-[:checked]` holati yo'q). */
const CHOICE_CARD =
  "flex min-h-16 w-full flex-col items-start gap-0.5 rounded-xl border border-border-strong bg-surface px-3.5 py-3 text-left " +
  "hover:border-text-subtle disabled:cursor-not-allowed disabled:opacity-45";

export const SuggestionChips = ({ onPick, disabled }: { onPick: (question: string) => void; disabled?: boolean }) => {
  const { t } = useTranslation("aiAdvisor");
  const labelId = useId();
  const items = useMemo(() => chipSuggestions(), []);
  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-xs text-text-muted">
        {t("suggest.label")}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        className={cx(
          "flex flex-wrap gap-2",
          // Telefonda bir qator, o'z konteynerida suriladi (sahifa gorizontal surilmaydi).
          "max-md:-mx-4 max-md:flex-nowrap max-md:overflow-x-auto max-md:px-4 max-md:[scrollbar-width:none]",
        )}
      >
        {items.map((item) => {
          const question = t(item.questionKey);
          return (
            <Pressable key={item.key} className={CHIP} disabled={disabled} onClick={() => onPick(question)}>
              {question}
            </Pressable>
          );
        })}
      </div>
    </div>
  );
};

export const EmptyChat = ({ onPick, disabled }: { onPick: (question: string) => void; disabled?: boolean }) => {
  const { t } = useTranslation("aiAdvisor");
  const labelId = useId();
  const items = useMemo(() => cardSuggestions(), []);
  return (
    <>
      <EmptyState framed icon={Sparkles} title={t("empty.title")} description={t("empty.text")} titleAs="h2" />
      <div className="flex flex-col gap-2">
        <span id={labelId} className="text-xs text-text-muted">
          {t("suggest.label")}
        </span>
        <div role="group" aria-labelledby={labelId} className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-2">
          {items.map((item) => {
            const question = t(item.questionKey);
            return (
              <Pressable key={item.key} className={CHOICE_CARD} disabled={disabled} onClick={() => onPick(question)}>
                <span className="text-sm font-semibold text-text">{question}</span>
                {item.hintKey ? <span className="text-xs text-text-muted">{t(item.hintKey)}</span> : null}
              </Pressable>
            );
          })}
        </div>
      </div>
    </>
  );
};
