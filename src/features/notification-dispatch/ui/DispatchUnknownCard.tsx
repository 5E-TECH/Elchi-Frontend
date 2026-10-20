// dizayn-v2: superadmin-notifications-send-unknown
import { useEffect, useRef } from "react";
import { History, Plus, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DispatchStatusBadge } from "../../../entities/notification-dispatch";
import { NoticeAlert } from "../../../entities/notification";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Badge, Button, Card } from "../../../shared/ui/primitives";

export type DispatchUnknownCardProps = {
  /** `timeout` — javob kelmadi (502–504, tarmoq); `running` — backend «ayni so'rov hali yuborilmoqda» dedi. */
  reason: "timeout" | "running";
  sentAt: string;
  retrying: boolean;
  /** «Qayta urinish» rad etildi (4xx/5xx) — tushunarli matn. */
  retryError: string | null;
  onRetry: () => void;
  onCheckHistory: () => void;
  onNewMessage: () => void;
};

const STEPS = ["dispatch.unknown.step1", "dispatch.unknown.step2", "dispatch.unknown.step3"] as const;

/**
 * NATIJA NOMA'LUM (maket `*-notifications-send-unknown`, ega S5): «Noma'lum» belgisi, ogohlantirish, 3 qadam;
 * «Tarixdan tekshirish» (tafsilot oynasi — `client_request_id` bo'yicha), «Qayta urinish» — AYNI so'rov (o'sha
 * `client_request_id`: xabar ketgan bo'lsa backend ikkinchi marta yubormaydi), «Yangi xabar» — boshqa xabar.
 * Telefonda tugmalar ustma-ust: asosiy tepada.
 */
export const DispatchUnknownCard = ({
  reason,
  sentAt,
  retrying,
  retryError,
  onRetry,
  onCheckHistory,
  onNewMessage,
}: DispatchUnknownCardProps) => {
  const { t, i18n } = useTranslation("notifications");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Skroll qiluvchi — shell'ning `<main>` i (oyna aylanmaydi); karta sahifa sarlavhasi ostida — tepaga.
    rootRef.current?.closest("main")?.scrollTo?.({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <Card
      ref={rootRef}
      tabIndex={-1}
      aria-live="polite"
      className="scroll-mt-4 focus-visible:outline-none"
      title={t("dispatch.result.title")}
      titleAddon={<DispatchStatusBadge status="unknown" />}
      actions={
        <span className="whitespace-nowrap text-[13px] text-text-muted">
          {formatDateTimeLocalized(sentAt, { language })}
        </span>
      }
      bodyClassName="flex flex-col gap-4"
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2 max-md:flex-col-reverse max-md:items-stretch">
          <Button variant="ghost" leftIcon={Plus} onClick={onNewMessage} className="mr-auto max-md:mr-0 max-md:h-12">
            {t("dispatch.newMessage")}
          </Button>
          <Button
            variant="secondary"
            leftIcon={RefreshCw}
            loading={retrying}
            loadingText={t("dispatch.unknown.retrying")}
            onClick={onRetry}
            className="max-md:h-12"
          >
            {t("dispatch.unknown.retry")}
          </Button>
          <Button leftIcon={History} onClick={onCheckHistory} className="max-md:h-12">
            {t("dispatch.checkHistory")}
          </Button>
        </div>
      }
      data-testid="dispatch-unknown"
    >
      {reason === "running" ? (
        <NoticeAlert tone="warning" title={t("dispatch.unknown.runningTitle")}>
          {t("dispatch.unknown.runningText")}
        </NoticeAlert>
      ) : (
        <NoticeAlert tone="warning" title={t("dispatch.unknown.title")}>
          {t("dispatch.unknown.text")}
        </NoticeAlert>
      )}
      {retryError ? (
        <NoticeAlert tone="danger" title={t("dispatch.unknown.retryFailed")}>
          {retryError}
        </NoticeAlert>
      ) : null}
      <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
        {STEPS.map((key, index) => (
          <li key={key} className="flex gap-2.5 text-[13px] text-text">
            <Badge className="shrink-0">{formatNumberLocalized(index + 1, { language })}</Badge>
            <span className="min-w-0">{t(key)}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
};
