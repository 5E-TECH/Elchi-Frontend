// dizayn-v2: superadmin-ai-assistant-answering, superadmin-ai-assistant-offline, superadmin-ai-assistant-unavailable, superadmin-ai-assistant-budget-exceeded
import { useTranslation } from "react-i18next";
import { CircleX, LoaderCircle, Plus, RefreshCw, WifiOff } from "lucide-react";
import { Button, Card, Skeleton, Spinner } from "../../../shared/ui/primitives";
import { MiniMarkdown } from "../../../shared/ui/markdown/MiniMarkdown";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { NoticeAlert } from "../../../entities/notification/ui/NoticeAlert";
import type { PendingTurn } from "../../../features/ai-chat";
import { AnswerNotes, AssistantArticle } from "./ChatMessages";

/**
 * Joriy savolga javob o'rni (maketlar `-answering`, `-offline`, `-unavailable` «Boshqa holatlar», `-budget-exceeded`).
 * Savol pufakchasi va tayyor javob (`AnswerCard`) — sahifada, tarix bilan bir ro'yxatda va tarixdagi kalit bilan
 * (`turnItemKey`): tarixga o'tganda DOM tuguni almashmaydi.
 *
 *   - yozilmoqda — «AI yordamchi · yozmoqda» + aylanuvchi belgi, `aria-busy`; tool kutilsa «Ma'lumot yig'ilmoqda…»,
 *     jonli matn (joriy qadam) va skelet qatorlar;
 *   - to'xtatildi — qisman matn, «AI xato qilishi mumkin.», «Javob to'xtatildi» + «Qayta yuborish»;
 *   - uzildi — qisman matn + «Aloqa uzildi» (oflaynda «Qayta yuborish» o'chiq);
 *   - xarajat shifti — xira izoh «Javob berilmadi: …» (sabab — sahifa ustidagi ogohlantirishda, `-budget-exceeded`);
 *   - xato — «Javob olib bo'lmadi» (yoki suhbat qutisi) + amal; suhbat to'lgan / topilmadi — «Yangi suhbat» savolni
 *     yangi suhbatga olib o'tadi (savol saqlanmagan).
 */

export type PendingReplyProps = {
  turn: PendingTurn;
  online: boolean;
  onRetry: () => void;
  /** «Yangi suhbat» (suhbat to'lgan / topilmadi) — savol yangi suhbatning maydoniga o'tadi. */
  onNewChat: (question: string) => void;
};

const WritingSkeleton = () => (
  <div aria-hidden="true" className="flex flex-col gap-2">
    <Skeleton shape="line" width="92%" tone="border" />
    <Skeleton shape="line" width="64%" tone="border" />
  </div>
);

export const PendingReply = ({ turn, online, onRetry, onNewChat }: PendingReplyProps) => {
  const { t } = useTranslation("aiAdvisor");
  const at = (value: string) => formatDateTimeLocalized(value);
  const live = turn.phase === "sending" || turn.phase === "streaming";

  if (live) {
    return (
      <AssistantArticle
        busy
        header={
          <>
            {t("chat.assistantWriting")}
            <Spinner size="sm" className="text-text-subtle" />
          </>
        }
      >
        <Card padding="none" aria-label={t("chat.writingLabel")}>
          <div className="flex flex-col gap-4 p-5 max-md:p-4">
            {turn.collecting ? (
              <p className="flex items-center gap-1.5 text-[13px] text-text-muted">
                <LoaderCircle size={14} aria-hidden="true" className="flex-none animate-spin motion-reduce:animate-none" />
                {t("chat.collecting")}
              </p>
            ) : null}
            {turn.text.trim() ? <MiniMarkdown source={turn.text} caret /> : null}
            <WritingSkeleton />
          </div>
        </Card>
      </AssistantArticle>
    );
  }
  if (turn.phase === "stopped") {
    return (
      <AssistantArticle header={t("chat.assistant", { time: at(turn.askedAt) })}>
        <Card padding="none" aria-label={t("chat.answerLabel")}>
          <div className="flex flex-col gap-3 p-5 max-md:p-4">
            {turn.text.trim() ? <MiniMarkdown source={turn.text} /> : null}
            {turn.text.trim() ? <AnswerNotes short /> : null}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
              <span className="text-xs text-text-muted">{t("chat.stopped")}</span>
              <Button variant="ghost" size="sm" leftIcon={RefreshCw} className="ml-auto" onClick={onRetry}>
                {t("chat.resend")}
              </Button>
            </div>
          </div>
        </Card>
      </AssistantArticle>
    );
  }
  if (turn.phase === "cut") {
    return (
      <AssistantArticle header={t("chat.assistant", { time: at(turn.askedAt) })}>
        <Card padding="none" aria-label={t("chat.answerLabel")}>
          <div className="flex flex-col gap-4 p-5 max-md:p-4">
            {turn.text.trim() ? <MiniMarkdown source={turn.text} /> : null}
            <NoticeAlert
              tone="danger"
              role="alert"
              icon={WifiOff}
              title={t("errors.cutTitle")}
              action={
                <Button variant="secondary" size="sm" leftIcon={RefreshCw} disabled={!online} onClick={onRetry}>
                  {t("chat.resend")}
                </Button>
              }
            >
              {online ? t("errors.cutText") : t("errors.cutTextOffline")}
            </NoticeAlert>
            <AnswerNotes short />
          </div>
        </Card>
      </AssistantArticle>
    );
  }
  if (turn.error?.variant === "cap") {
    // Maket `-budget-exceeded`: javob o'rnida xira izoh, sabab va muddat — sahifa ustidagi ogohlantirishda.
    return (
      <AssistantArticle header={t("chat.assistant", { time: at(turn.askedAt) })}>
        <p className="flex items-start gap-1.5 text-[13px] text-text-muted">
          <CircleX size={14} aria-hidden="true" className="mt-[3px] flex-none text-danger-fg" />
          <span>{t("errors.capTurn")}</span>
        </p>
      </AssistantArticle>
    );
  }
  if (turn.error) {
    const view = turn.error;
    return (
      <AssistantArticle header={t("chat.assistant", { time: at(turn.askedAt) })}>
        <NoticeAlert
          tone={view.tone}
          role={view.tone === "danger" ? "alert" : "status"}
          title={t(view.titleKey)}
          action={
            view.newChat ? (
              <Button variant="secondary" size="sm" leftIcon={Plus} onClick={() => onNewChat(turn.question)}>
                {t("newChat")}
              </Button>
            ) : view.canRetry ? (
              <Button variant="secondary" size="sm" leftIcon={RefreshCw} disabled={!online} onClick={onRetry}>
                {t("chat.resend")}
              </Button>
            ) : undefined
          }
        >
          {t(view.descriptionKey)}
        </NoticeAlert>
      </AssistantArticle>
    );
  }
  return null;
};
