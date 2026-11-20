// dizayn-v2: (maket yo'q) superadmin-users-detail-telegram
import { memo, useEffect, useId, useRef, useState } from "react";
import { Link as LinkIcon, Send, TriangleAlert, Unlink, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { inactiveReasonKey, inactiveReasonTone } from "../../../entities/notification";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { cx } from "../../../shared/lib/cx";
import { formatDateLocalized, toValidDate } from "../../../shared/lib/formatDateTime";
import { notify } from "../../../shared/lib/notify";
import {
  Button,
  Card,
  ErrorState,
  SegmentedControl,
  Skeleton,
  StatusBadge,
  useConfirm,
} from "../../../shared/ui/primitives";
import { GROUP_LINK_POLL_MS, MarketGroupLinkDialog, toLinkWindow, type GroupLinkCode } from "../../telegram-link";
import {
  useBranchGroupLinkCode,
  useBranchTelegram,
  useSetBranchReportTarget,
  useUnlinkBranchGroup,
} from "../api/useBranchTelegram";
import type { BranchReportTarget } from "../model/types";

/** `.el-stat-icon` — neytral ikonka qutisi (CODE-MAP). */
const STAT_ICON = "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted";
const ROW = "flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-border px-5 py-3.5 max-md:px-4";
const MUTED = "text-[13px] leading-[18px] text-text-muted";

type LinkSession = {
  open: boolean;
  code: GroupLinkCode;
  /** Shu sessiyadan oldingi `linked_at` — o'zgarsa, bot yangi guruhni ulagan. */
  baselineLinkedAt: string | null;
  openedAt: number;
  expiresAtMs: number;
  totalMs: number;
};

export type BranchTelegramCardProps = {
  branchId: string;
  branchName: string;
  className?: string;
};

/**
 * «KASSA HISOBOTI · TELEGRAM» — filial kassasi (smena) yopilganda (qo'lda yoki kun oxirida avtomatik) hisobot shu
 * filialning Telegram guruhiga, yoki «Shaxsiy chatga» tanlansa — filial menejerlarining shaxsiy chatiga (bot orqali)
 * boradi. Maket yo'q — eng yaqini `superadmin-users-detail-telegram` («Telegram guruhi» kartasi) va uning ulash oynasi.
 *
 * - «Filial guruhi» qatori: «Ulangan» + guruh nomi va sana / «Nofaol» + sabab / «Ulanmagan»; amallar — «Ulash»,
 *   «Qayta ulash» (nofaol), «Almashtirish» va «Uzish» (tasdiq bilan). Ulash — bir martalik havola oynasi
 *   (`MarketGroupLinkDialog`): oyna ochiq ekan holat har 4 s o'qiladi, bot guruhni ulasa o'zi yopiladi.
 * - «Hisobot qayerga» — «Guruhga» · «Shaxsiy chatga» (`PATCH …/report-target`); guruh tanlangan-u ulanmagan bo'lsa
 *   ogohlantirish.
 * - `can_manage: false` (HQ filiali — faqat superadmin) — faqat ko'rish.
 */
export const BranchTelegramCard = memo(({ branchId, branchName, className }: BranchTelegramCardProps) => {
  const { t, i18n } = useTranslation("branches");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const confirm = useConfirm();
  const headingId = useId();
  const targetLabelId = useId();
  const rowRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<LinkSession | null>(null);
  const [expiredToken, setExpiredToken] = useState<string | null>(null);

  const dialogOpen = session?.open === true;
  const expired = session != null && expiredToken === session.code.token;
  const statusQuery = useBranchTelegram(branchId, {
    refetchInterval: dialogOpen && !expired ? GROUP_LINK_POLL_MS : false,
  });
  const linkCode = useBranchGroupLinkCode();
  const setTarget = useSetBranchReportTarget();
  const unlink = useUnlinkBranchGroup();

  const status = statusQuery.data;
  const group = status?.group ?? null;
  const canManage = status?.canManage === true;

  // Havola muddati tugaganda — «Havola muddati tugadi».
  useEffect(() => {
    if (!dialogOpen || !session) return;
    const { token } = session.code;
    const timer = window.setTimeout(() => setExpiredToken(token), Math.max(0, session.expiresAtMs - Date.now()));
    return () => window.clearTimeout(timer);
  }, [dialogOpen, session]);

  // Bot guruhni uladi (yangi `linked_at`, faol) — oyna yopiladi (holat render paytida moslanadi), xabar effektda.
  const [connectedNotice, setConnectedNotice] = useState(0);
  const shownNotice = useRef(0);
  if (
    dialogOpen &&
    session &&
    statusQuery.dataUpdatedAt >= session.openedAt &&
    group?.isActive &&
    group.linkedAt !== session.baselineLinkedAt
  ) {
    setSession({ ...session, open: false });
    setConnectedNotice(connectedNotice + 1);
  }
  useEffect(() => {
    if (!connectedNotice || connectedNotice <= shownNotice.current) return;
    shownNotice.current = connectedNotice;
    notify.success(t("telegram.connectedToast"), { description: t("telegram.connectedText", { branch: branchName }) });
  }, [connectedNotice, branchName, t]);

  const startLink = async () => {
    if (linkCode.isPending) return;
    try {
      const code = await linkCode.mutateAsync(branchId);
      const linkWindow = toLinkWindow(code.expires_at);
      setExpiredToken(null);
      setSession({
        open: true,
        code,
        baselineLinkedAt: group?.linkedAt ?? null,
        openedAt: Date.now(),
        expiresAtMs: linkWindow.expiresAtMs,
        totalMs: linkWindow.totalMs,
      });
    } catch (error) {
      notify.error(t("telegram.linkError"), { description: getBackendErrorMessage(error) });
    }
  };

  const unlinkGroup = async () => {
    const ok = await confirm({
      title: t("telegram.unlinkConfirm.title"),
      description: t("telegram.unlinkConfirm.description", { branch: branchName }),
      confirmLabel: t("telegram.unlinkConfirm.confirm"),
      tone: "danger",
    });
    if (!ok) return;
    try {
      await unlink.mutateAsync(branchId);
      notify.success(t("telegram.unlinked"));
    } catch (error) {
      notify.error(t("telegram.unlinkError"), { description: getBackendErrorMessage(error) });
    }
  };

  const changeTarget = async (reportTarget: BranchReportTarget) => {
    if (!status || reportTarget === status.reportTarget) return;
    try {
      await setTarget.mutateAsync({ branchId, reportTarget });
      notify.success(t(reportTarget === "private" ? "telegram.targetPrivateSaved" : "telegram.targetGroupSaved"));
    } catch (error) {
      notify.error(t("telegram.targetError"), { description: getBackendErrorMessage(error) });
    }
  };

  const statusLine = () => {
    if (statusQuery.isLoading) return <Skeleton width={140} height={20} />;
    if (!group) {
      return (
        <>
          <StatusBadge tone="neutral" label={t("telegram.notConnected")} />
          <span className={MUTED}>{t("telegram.notConnectedHint")}</span>
        </>
      );
    }
    if (!group.isActive) {
      const key = inactiveReasonKey(group.inactiveReason);
      return (
        <>
          <StatusBadge tone={inactiveReasonTone(group.inactiveReason)} label={t("telegram.inactive")} />
          <span className={MUTED}>{t(`telegram.reason.${key}`)}</span>
        </>
      );
    }
    return (
      <>
        <StatusBadge tone="success" label={t("telegram.connected")} />
        <span className={MUTED}>
          {[
            group.title ? `«${group.title}»` : null,
            toValidDate(group.linkedAt)
              ? t("telegram.since", { date: formatDateLocalized(group.linkedAt, { language }) })
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </>
    );
  };

  const groupActions = () => {
    if (!statusQuery.isSuccess || !canManage) return null;
    const busy = linkCode.isPending || unlink.isPending;
    const linkLabel = !group ? "telegram.link" : group.isActive ? "telegram.replace" : "telegram.relink";
    return (
      <div className="flex flex-wrap items-center gap-2 max-md:basis-full">
        <Button
          variant="secondary"
          size="sm"
          leftIcon={LinkIcon}
          aria-haspopup="dialog"
          loading={linkCode.isPending}
          disabled={busy}
          onClick={() => void startLink()}
          className="max-md:h-11 max-md:flex-1 max-md:text-sm"
        >
          {t(linkLabel)}
        </Button>
        {group ? (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={Unlink}
            loading={unlink.isPending}
            disabled={busy}
            onClick={() => void unlinkGroup()}
            className="max-md:h-11 max-md:flex-1 max-md:text-sm"
          >
            {t("telegram.unlink")}
          </Button>
        ) : null}
      </div>
    );
  };

  const targetWarning =
    status && status.reportTarget === "group" && !group?.isActive ? (
      <span role="note" className="inline-flex items-start gap-1.5 text-[13px] leading-[18px] text-warning-fg">
        <TriangleAlert aria-hidden="true" size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
        {t("telegram.targetGroupMissing")}
      </span>
    ) : null;

  const body = statusQuery.isError ? (
    <div className="px-5 py-4 max-md:px-4">
      <ErrorState
        size="chart"
        error={statusQuery.error}
        title={t("telegram.loadError")}
        description={t("telegram.loadErrorText")}
        onRetry={() => void statusQuery.refetch()}
        retrying={statusQuery.isFetching}
        className="min-h-0"
      />
    </div>
  ) : (
    <>
      <div
        ref={rowRef}
        role="group"
        aria-labelledby={headingId}
        tabIndex={-1}
        className={cx(ROW, "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-action")}
      >
        <div className="flex min-w-0 flex-[1_1_220px] items-start gap-3">
          <span aria-hidden="true" className={STAT_ICON}>
            <Users size={18} strokeWidth={2} />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h3 id={headingId} className="m-0 text-sm font-semibold text-text">
              {t("telegram.groupTitle")}
            </h3>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">{statusLine()}</div>
          </div>
        </div>
        {groupActions()}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-3.5 max-md:px-4">
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1">
          <span id={targetLabelId} className="text-sm font-semibold text-text">
            {t("telegram.targetLabel")}
          </span>
          <span className={MUTED}>
            {t(status?.reportTarget === "private" ? "telegram.targetPrivateHint" : "telegram.targetGroupHint")}
          </span>
          {targetWarning}
        </div>
        {statusQuery.isLoading ? (
          <Skeleton width={220} height={40} />
        ) : status ? (
          <SegmentedControl<BranchReportTarget>
            ariaLabel={t("telegram.targetLabel")}
            fullWidth="phone"
            className="max-md:basis-full"
            options={[
              { value: "group", label: t("telegram.targetGroup"), disabled: !canManage || setTarget.isPending },
              { value: "private", label: t("telegram.targetPrivate"), disabled: !canManage || setTarget.isPending },
            ]}
            value={status.reportTarget}
            onValueChange={(value) => void changeTarget(value)}
          />
        ) : null}
      </div>
    </>
  );

  return (
    <Card
      as="section"
      title={
        <span className="inline-flex items-center gap-3">
          <span aria-hidden="true" className={STAT_ICON}>
            <Send size={18} strokeWidth={2} />
          </span>
          {t("telegram.title")}
        </span>
      }
      divided
      padding="none"
      className={cx("min-w-0", className)}
    >
      <p className={cx(MUTED, "m-0 px-5 pt-3.5 max-md:px-4")}>{t("telegram.hint")}</p>
      <div className="mt-1 flex flex-col">{body}</div>
      {session ? (
        <MarketGroupLinkDialog
          open={session.open}
          code={session.code}
          description={t("telegram.dialogDescription", { branch: branchName })}
          expiresAtMs={session.expiresAtMs}
          totalMs={session.totalMs}
          expired={expired}
          renewing={linkCode.isPending}
          watching
          returnFocus={rowRef}
          onRenew={() => void startLink()}
          onClose={() => setSession({ ...session, open: false })}
        />
      ) : null}
    </Card>
  );
});

BranchTelegramCard.displayName = "BranchTelegramCard";
