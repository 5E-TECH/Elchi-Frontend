// dizayn-v2: superadmin-ai-assistant
import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Copy, FileText, Info, Sparkles } from "lucide-react";
import { Card, IconButton } from "../../../shared/ui/primitives";
import { MiniMarkdown } from "../../../shared/ui/markdown/MiniMarkdown";
import { copyToClipboard } from "../../../shared/lib/clipboard";
import { markdownToPlainText } from "../../../shared/lib/miniMarkdown";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { notify } from "../../../shared/lib/notify";
import { NoticeAlert } from "../../../entities/notification/ui/NoticeAlert";
import { failedStopCode, formatSourcesLine, type AiSource } from "../../../entities/ai-advisor";

/**
 * Suhbat xabarlari (maket `superadmin-ai-assistant`, `role="log"` ichida): «Siz · vaqt» pufakchasi (o'ngda, `sunken`),
 * AI javobi — `Sparkles` belgisi (telefonda yo'q) + «AI yordamchi · vaqt» + javob kartasi («Manba», ogohlantirish,
 * «Javobni nusxalash»). Javob bo'lmagan tarix qatori — xira izoh (B10).
 */

const time = (value: string | null | undefined) => formatDateTimeLocalized(value ?? null);

/** `.el-stat-icon` — neytral (rangsiz) AI belgisi; telefonda yashirin. */
export const AssistantAvatar = () => (
  <span
    aria-hidden="true"
    className="inline-flex size-9 flex-none items-center justify-center rounded-[10px] bg-sunken text-text-muted max-md:hidden"
  >
    <Sparkles size={18} />
  </span>
);

export const UserBubble = ({ text, at, bubbleRef }: { text: string; at: string | null; bubbleRef?: (node: HTMLDivElement | null) => void }) => {
  const { t } = useTranslation("aiAdvisor");
  return (
    <div ref={bubbleRef} className="flex flex-col items-end gap-1.5">
      <span className="text-xs text-text-muted">{t("chat.you", { time: time(at) })}</span>
      <p className="max-w-[min(560px,92%)] rounded-[14px_14px_6px_14px] bg-sunken px-4 py-3 text-sm leading-[1.6] whitespace-pre-wrap wrap-break-word text-text">
        {text}
      </p>
    </div>
  );
};

/** AI xabari o'rami: belgi + sarlavha qatori + tana. */
export const AssistantArticle = ({
  header,
  busy,
  children,
}: {
  header: ReactNode;
  busy?: boolean;
  children: ReactNode;
}) => {
  const headerId = useId();
  return (
    <article aria-labelledby={headerId} aria-busy={busy || undefined} className="flex items-start gap-3">
      <AssistantAvatar />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span id={headerId} className="inline-flex items-center gap-2 text-xs text-text-muted">
          {header}
        </span>
        {children}
      </div>
    </article>
  );
};

/** Kichik izoh qatori (`.el-xs.el-muted` + 14 px ikonka). */
export const NoteLine = ({ icon: Icon, children }: { icon: typeof Info; children: ReactNode }) => (
  <p className="flex items-start gap-1.5 text-xs text-text-muted">
    <Icon size={14} aria-hidden="true" className="mt-0.5 flex-none" />
    <span className="min-w-0 wrap-break-word">{children}</span>
  </p>
);

/** «Manba: …» + «AI xato qilishi mumkin — …» (javob kartasi ichida). */
export const AnswerNotes = ({ sources, short = false }: { sources?: readonly AiSource[]; short?: boolean }) => {
  const { t, i18n } = useTranslation("aiAdvisor");
  const line = sources ? formatSourcesLine(sources, t, i18n.language) : null;
  return (
    <div className="flex flex-col gap-1">
      {line ? <NoteLine icon={FileText}>{line}</NoteLine> : null}
      <NoteLine icon={Info}>{short ? t("chat.disclaimerShort") : t("chat.disclaimer")}</NoteLine>
    </div>
  );
};

/** «Javobni nusxalash» — ekranda ko'ringan matn (markdown belgilarisiz, jadval — tab bilan). */
export const CopyAnswerButton = ({ text }: { text: string }) => {
  const { t } = useTranslation("aiAdvisor");
  const onCopy = async () => {
    if (await copyToClipboard(markdownToPlainText(text))) notify.success(t("chat.copied"));
    else notify.error(t("chat.copyFailed"), { description: t("chat.copyFailedHint") });
  };
  return <IconButton size="sm" variant="ghost" icon={Copy} label={t("chat.copy")} onClick={() => void onCopy()} />;
};

/** Tayyor javob: markdown + «Manba» + ogohlantirish, pastda «Javobni nusxalash». */
export const AnswerCard = ({ text, sources, at }: { text: string; sources: readonly AiSource[]; at: string | null }) => {
  const { t } = useTranslation("aiAdvisor");
  return (
    <AssistantArticle header={t("chat.assistant", { time: time(at) })}>
      <Card
        padding="none"
        aria-label={t("chat.answerLabel")}
        footer={
          <div className="ml-auto flex items-center gap-1">
            <CopyAnswerButton text={text} />
          </div>
        }
      >
        <div className="flex flex-col gap-4 p-5 max-md:p-4">
          <MiniMarkdown source={text} />
          <AnswerNotes sources={sources} />
        </div>
      </Card>
    </AssistantArticle>
  );
};

/** Tarixdagi javobsiz qator (backend xato matnini javob o'rnida saqlagan) — xira izoh. */
export const FailedNote = ({ stop, at }: { stop: string | null; at: string | null }) => {
  const { t } = useTranslation("aiAdvisor");
  return (
    <AssistantArticle header={t("chat.assistant", { time: time(at) })}>
      <NoticeAlert tone="neutral" role="note" title={t("errors.answerFailed")}>
        {t(`errors.codes.${failedStopCode(stop)}`)}
      </NoticeAlert>
    </AssistantArticle>
  );
};
