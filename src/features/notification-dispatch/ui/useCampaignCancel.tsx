// dizayn-v2: superadmin-notifications-campaign-cancel-dialog
import { CircleX } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import {
  CampaignStatusBadge,
  useCancelCampaign,
  type CampaignDisplayStatus,
} from "../../../entities/notification-campaign";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import { useConfirm } from "../../../shared/ui/primitives";
import { CampaignProgressBar } from "./CampaignProgressBar";

export type CampaignCancelTarget = {
  id: string;
  title: string;
  display: CampaignDisplayStatus;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  progressPct: number;
};

/**
 * «KAMPANIYANI BEKOR QILISH» (maket `superadmin-notifications-campaign-cancel-dialog`): xavfli tasdiq — sarlavha
 * «Kampaniyani bekor qilasizmi?», oqibat matni, kampaniya kartasi (nom + holat, yuborilayotgan bo'lsa progress va
 * «N / M»), «Qolgan N ta qabul qiluvchiga yuborilmaydi»; «Yopish» · «Kampaniyani bekor qilish». Yakunlangan kampaniya
 * — 409: xabar va `onConflict` (holatni yangilash). Natija kartasi va «Kampaniyalar tarixi» bir xil oynani ishlatadi.
 */
export const useCampaignCancel = () => {
  const { t, i18n } = useTranslation("notifications");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const num = (value: number) => formatNumberLocalized(value, { language });
  const confirm = useConfirm();
  const cancel = useCancelCampaign();

  const ask = (campaign: CampaignCancelTarget, { onConflict }: { onConflict?: () => void } = {}) => {
    const processed = campaign.sent + campaign.failed + campaign.skipped;
    const remaining = Math.max(0, campaign.total - processed);
    return confirm({
      title: t("campaign.progress.cancelTitle"),
      description: t("campaign.progress.cancelText"),
      confirmLabel: t("campaign.progress.cancelConfirm"),
      cancelLabel: t("campaign.progress.cancelClose"),
      tone: "danger",
      icon: CircleX,
      confirmIcon: CircleX,
      details: (
        <div className="flex min-w-0 flex-col gap-2.5" data-testid="campaign-cancel-summary">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 font-semibold text-text [overflow-wrap:anywhere]">{campaign.title}</span>
            <CampaignStatusBadge status={campaign.display} />
          </div>
          {campaign.display === "sending" ? (
            <div className="flex min-w-0 items-center gap-3">
              <CampaignProgressBar
                value={campaign.progressPct}
                label={t("campaign.progress.bar")}
                track="surface"
                className="flex-1"
              />
              <span className="shrink-0 text-xs text-text-muted tabular-nums">
                {t("campaign.history.progress", { done: num(campaign.sent), total: num(campaign.total) })}
              </span>
            </div>
          ) : null}
          {remaining ? (
            <span className="text-[13px] text-text">
              <Trans
                t={t}
                i18nKey="campaign.progress.cancelRemainingRich"
                values={{ value: num(remaining) }}
                components={{ b: <span className="font-semibold" /> }}
              />
            </span>
          ) : null}
        </div>
      ),
      onConfirm: async () => {
        try {
          await cancel.mutateAsync(campaign.id);
          notify.success(t("campaign.progress.cancelled"));
        } catch (error) {
          if (getErrorStatus(error) !== 409) throw error;
          // Allaqachon yakunlangan — xabar va yangi holat (oyna yopiladi).
          notify.error(t("campaign.progress.cancelConflict"));
          onConflict?.();
        }
      },
      errorMessage: () => t("campaign.progress.cancelFailed"),
    });
  };

  return ask;
};
