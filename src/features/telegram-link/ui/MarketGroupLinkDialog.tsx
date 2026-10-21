// dizayn-v2: superadmin-users-detail-telegram-group-dialog, superadmin-users-detail-telegram-group-expired-dialog, admin-users-detail-telegram-group-dialog, admin-users-detail-telegram-group-expired-dialog, market-profile-telegram-group-dialog, market-profile-telegram-group-expired-dialog
import type { RefObject } from "react";
import { Clock, ExternalLink, RefreshCw, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { NotificationGroupType } from "../../../entities/notification";
import { cx } from "../../../shared/lib/cx";
import { formatTimeLocalized } from "../../../shared/lib/formatDateTime";
import { Button, Dialog, EmptyState, Spinner, buttonClasses } from "../../../shared/ui/primitives";
import { useIsPhone } from "../../../shared/ui/primitives/date/useIsPhone";
import type { GroupLinkCode } from "../model/types";
import { LinkCountdown } from "./LinkCountdown";
import { LinkQrImage, LinkQrPanel } from "./LinkQrPanel";

type StepsMode = "desktop" | "phone" | "command";

/** Qadam kalitlari (`telegramLink:group.*`); 3-qadam holat shu oynada kuzatilishiga bog'liq. */
const stepKeys = (mode: StepsMode, watching: boolean): readonly string[] => {
  const last = watching ? "group.step3" : "group.step3Notify";
  if (mode === "phone") return ["group.phoneStep1", "group.step2", last];
  if (mode === "command") return ["group.commandStep1", "group.commandStep2", last];
  return ["group.step1", "group.step2", last];
};

/** Qadamlar ro'yxati; raqam doirasi sunken ichida — `surface`, oddiy fonda — `sunken` (maket). */
const Steps = ({ mode, watching, onSunken }: { mode: StepsMode; watching: boolean; onSunken?: boolean }) => {
  const { t } = useTranslation("telegramLink");
  return (
    <ol aria-label={t("stepsLabel")} className="m-0 flex list-none flex-col gap-2.5 p-0">
      {stepKeys(mode, watching).map((key, index) => (
        <li key={key} className="flex items-start gap-2.5 text-sm text-text">
          <span
            aria-hidden="true"
            className={cx(
              "inline-flex size-6 flex-none items-center justify-center rounded-full text-xs font-bold text-text-muted",
              onSunken ? "bg-surface" : "bg-sunken",
            )}
          >
            {index + 1}
          </span>
          <span className="min-w-0 pt-0.5">{t(key)}</span>
        </li>
      ))}
    </ol>
  );
};

export type MarketGroupLinkDialogProps = {
  open: boolean;
  code: GroupLinkCode;
  /** Sarlavha ostida: «{market} · {guruh turi}». */
  marketName: string;
  groupType: NotificationGroupType;
  /** Havola amal qiladigan oxirgi lahza (ms, mahalliy soat bo'yicha). */
  expiresAtMs: number;
  /** Sanoqning to'liq muddati (progress 100% i), sukut — 10 daqiqa. */
  totalMs?: number;
  expired: boolean;
  renewing: boolean;
  /**
   * Ulanish shu oynada kuzatiladimi (`GET /notifications?market_id&group_type`, faqat superadmin/admin):
   * `true` — «Guruh ulanishi kutilmoqda…» va «holat shu yerda yangilanadi»; `false` (market o'zi — holat
   * endpointi TG-C da) — kutish qatori yo'q, 3-qadam «ulanganda sizga bildirishnoma keladi».
   */
  watching: boolean;
  /** Yopilgach fokus shu elementga (sukut — oynani ochgan element). */
  returnFocus?: RefObject<HTMLElement | null>;
  onRenew: () => void;
  onClose: () => void;
};

/**
 * «Telegram guruhini ulash» oynasi — maketlar `{superadmin,admin}-users-detail-telegram-group{,-expired}-dialog`,
 * `market-profile-telegram-group{,-expired}-dialog`:
 * - havola bor, kompyuter/planshet: `sunken` blokda QR (oq ramka) + «Bir martalik havola tayyor» va qadamlar;
 *   telefonda — qadamlar va yig'ilgan «Boshqa telefondan — QR kod». Ostida sanoq va progress (`LinkCountdown`),
 *   kuzatilsa «Guruh ulanishi kutilmoqda…». Asosiy amal — «Telegram'da ochish» (`t.me/<bot>?startgroup=<kod>`);
 * - buyruq rejimi (`deep_link` yo'q — bot nomi sozlanmagan; maket yo'q, naqsh `common-profile-telegram-command-dialog`):
 *   buyruq, muddat (sanoqsiz), o'z qadamlari, faqat «Yopish»;
 * - muddati tugadi: `sunken` ichida bo'sh holat va «Yangi havola olish».
 * Telefonda o'zi pastki varaqa (`Dialog`).
 */
export const MarketGroupLinkDialog = ({
  open,
  code,
  marketName,
  groupType,
  expiresAtMs,
  totalMs,
  expired,
  renewing,
  watching,
  returnFocus,
  onRenew,
  onClose,
}: MarketGroupLinkDialogProps) => {
  const { t } = useTranslation("telegramLink");
  const isPhone = useIsPhone();
  const deepLink = code.deep_link;
  const typeLabel = t(groupType === "cancel" ? "group.typeCancel" : "group.typeCreate");

  const footer = (
    <>
      <Button variant="secondary" disabled={renewing} onClick={onClose}>
        {t("close")}
      </Button>
      {expired ? (
        <Button leftIcon={RefreshCw} loading={renewing} onClick={onRenew}>
          {t("renew")}
        </Button>
      ) : deepLink ? (
        <a href={deepLink} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "primary" })}>
          <ExternalLink aria-hidden="true" size={18} strokeWidth={2} className="shrink-0" />
          <span className="min-w-0 truncate">{t("open")}</span>
        </a>
      ) : null}
    </>
  );

  const linkBody = deepLink ? (
    isPhone ? (
      <div className="flex flex-col gap-4">
        <Steps mode="phone" watching={watching} />
        <LinkQrPanel collapsible value={deepLink} alt={t("group.qrAlt")} size={176} />
      </div>
    ) : (
      <section
        aria-label={t("group.ready")}
        className="flex items-start gap-5 rounded-[14px] bg-sunken p-4"
      >
        {/* QR oq maydonda (`bg-on-nav` — tungi mavzuda ham oq): kamera har ikki mavzuda o'qiydi. */}
        <div className="flex-none rounded-[10px] bg-on-nav p-2">
          <LinkQrImage value={deepLink} alt={t("group.qrAlt")} size={160} rounded={false} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3.5">
          <h3 className="m-0 text-sm font-semibold text-text">{t("group.ready")}</h3>
          <Steps mode="desktop" watching={watching} onSunken />
        </div>
      </section>
    )
  ) : (
    <>
      <div className="flex flex-col gap-2 rounded-[14px] bg-sunken p-4">
        <p className="m-0 text-[13px] leading-[18px] text-text-muted">{t("group.commandHint")}</p>
        <code className="break-all font-mono text-sm font-semibold text-text select-all">{code.command}</code>
        <p className="m-0 text-[13px] leading-[18px] text-text-muted">
          {t("expiresAt", { time: formatTimeLocalized(expiresAtMs) })}
        </p>
      </div>
      <Steps mode="command" watching={watching} />
    </>
  );

  const body = expired ? (
    <EmptyState
      size="chart"
      role="status"
      icon={Clock}
      title={t("group.expiredTitle")}
      description={t("group.expiredText")}
      className="rounded-[14px] px-2 [&_[data-state-icon]]:bg-surface"
    />
  ) : (
    <>
      {linkBody}
      {deepLink ? <LinkCountdown expiresAtMs={expiresAtMs} totalMs={totalMs} /> : null}
      {watching ? (
        <p
          role="status"
          className="m-0 flex items-center gap-2 text-[13px] leading-[18px] font-semibold text-text-muted"
        >
          <Spinner size="sm" />
          {t("group.waiting")}
        </p>
      ) : null}
    </>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={renewing}
      returnFocus={returnFocus ?? true}
      size="lg"
      icon={Users}
      title={t("group.title")}
      description={t("group.description", { market: marketName, type: typeLabel })}
      footer={footer}
    >
      {body}
    </Dialog>
  );
};
