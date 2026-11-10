// dizayn-v2: superadmin-ai-assistant-answering, superadmin-ai-assistant-offline, superadmin-ai-assistant-unavailable
import { useCallback, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LoaderCircle, Plus, RefreshCw, WifiOff } from "lucide-react";
import { Button, Card, Skeleton, Spinner } from "../../../shared/ui/primitives";
import { MiniMarkdown } from "../../../shared/ui/markdown/MiniMarkdown";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { NoticeAlert } from "../../../entities/notification/ui/NoticeAlert";
import type { PendingTurn } from "../../../features/ai-chat";
import { AnswerCard, AnswerNotes, AssistantArticle, UserBubble } from "./ChatMessages";

/**
 * Joriy savol (maketlar `-answering`, `-offline`, `-unavailable` «Boshqa holatlar»):
 *
 *   - yozilmoqda — «AI yordamchi · yozmoqda» + aylanuvchi belgi, `aria-busy`; tool kutilsa «Ma'lumot yig'ilmoqda…»,
 *     jonli matn (joriy qadam) va skelet qatorlar;
 *   - to'xtatildi — qisman matn, «AI xato qilishi mumkin.», «Javob to'xtatildi» + «Qayta yuborish»;
 *   - uzildi — qisman matn + «Aloqa uzildi» (oflaynda «Qayta yuborish» o'chiq);
 *   - xato — «Javob olib bo'lmadi» (yoki limit / suhbat qutisi) + amal.
 */

export type PendingTurnViewProps = {
  turn: PendingTurn;
  online: boolean;
  onRetry: () => void;
  onNewChat: () => void;
};

const WritingSkeleton = () => (
  <div aria-hidden="true" className="flex flex-col gap-2">
    <Skeleton shape="line" width="92%" tone="border" />
    <Skeleton shape="line" width="64%" tone="border" />
  </div>
);

export const PendingTurnView = ({ turn, online, onRetry, onNewChat }: PendingTurnViewProps) => {
  const { t } = useTranslation("aiAdvisor");
  // Yangi savol ko'rinadigan joyga suriladi (foydalanuvchi o'qiyotgan joy — oqim davomida majburan surilmaydi).
  const bubbleRef = useCallback((node: HTMLDivElement | null) => {
    node?.scrollIntoView?.({ block: "nearest" });
  }, []);
  const at = (value: string) => formatDateTimeLocalized(value);
  const live = turn.phase === "sending" || turn.phase === "streaming";

  let reply: ReactNode = null;

  if (live) {
    reply = (
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
            {turn.text.trim() ? <MiniMarkdown source={turn.text} /> : null}
            <WritingSkeleton />
          </div>
        </Card>
      </AssistantArticle>
    );
  } else if (turn.phase === "done" && turn.answer) {
    reply = <AnswerCard text={turn.answer.text} sources={turn.answer.sources} at={turn.answer.at} />;
  } else if (turn.phase === "stopped") {
    reply = (
      <AssistantArticle header={t("chat.assistant", { time: at(turn.askedAt) })}>
        <Card padding="none" aria-label={t("chat.answerLabel")}>
          <div className="flex flex-col gap-3 p-5 max-md:p-4">
            {turn.text.trim() ? <MiniMarkdown source={turn.text} className="text-sm" /> : null}
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
  } else if (turn.phase === "cut") {
    reply = (
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
  } else if (turn.error) {
    const view = turn.error;
    reply = (
      <AssistantArticle header={t("chat.assistant", { time: at(turn.askedAt) })}>
        <NoticeAlert
          tone={view.tone}
          role={view.tone === "danger" ? "alert" : "status"}
          title={t(view.titleKey)}
          action={
            view.newChat ? (
              <Button variant="secondary" size="sm" leftIcon={Plus} onClick={onNewChat}>
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

  return (
    <>
      <UserBubble text={turn.question} at={turn.askedAt} bubbleRef={bubbleRef} />
      {reply}
    </>
  );
};
