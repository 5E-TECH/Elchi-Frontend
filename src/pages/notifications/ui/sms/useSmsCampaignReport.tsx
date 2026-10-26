// dizayn-v2: superadmin-notifications-sms-campaign, superadmin-notifications-campaign-report-dialog
import { useState, type ReactNode } from "react";
import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SmsCampaignHistoryItem } from "../../../../entities/sms";
import { CampaignReportDialog, type SmsCampaignReportTarget } from "../../../../features/notification-dispatch";
import { formatDateTimeLocalized } from "../../../../shared/lib/formatDateTime";
import { Button, type DataTableColumn } from "../../../../shared/ui/primitives";

/** Rejalashtirilgan (hali yuborilmagan, KM-6 `status`) SMS kampaniyasida hisobot yo'q — bildirishnoma tarixidagi qoida. */
const hasReport = (item: SmsCampaignHistoryItem) => (item as { status?: unknown }).status !== "scheduled";

/**
 * SMS «KAMPANIYALAR TARIXI» → «Hisobot» (H7kpCman): har qatorda «Hisobot» tugmasi umumiy kampaniya hisoboti oynasini
 * (`CampaignReportDialog`, maket `superadmin-notifications-campaign-report-dialog`) SMS rejimida ochadi —
 * `GET /notifications/sms/campaigns/:id/report` (bo'laklar, kodlash, operator hisoboti, taxminiy narx),
 * «Yetkazilmaganlar» (maskalangan telefon + sabab) va CSV (faqat superadmin). Tarix ustunlari va kartasi o'zgarmaydi —
 * oxiriga tugma qo'shiladi (`columns`, `renderCard` o'ramlari), oyna — `dialog`.
 */
export const useSmsCampaignReport = () => {
  const { t, i18n } = useTranslation("notifications");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [target, setTarget] = useState<SmsCampaignReportTarget | null>(null);

  const button = (item: SmsCampaignHistoryItem, block = false) =>
    hasReport(item) ? (
      <Button
        size={block ? "md" : "sm"}
        variant="secondary"
        fullWidth={block}
        leftIcon={FileText}
        aria-haspopup="dialog"
        aria-label={t("campaign.report.smsReportLabel", {
          date: formatDateTimeLocalized(item.created_at, { language }),
        })}
        onClick={() => setTarget({ kind: "sms", id: String(item.id), text: item.text, created_at: item.created_at })}
        className={block ? "max-md:h-12" : undefined}
      >
        {t("campaign.history.report")}
      </Button>
    ) : null;

  return {
    /** Jadval ustunlari + «Hisobot». */
    columns: (columns: DataTableColumn<SmsCampaignHistoryItem>[]): DataTableColumn<SmsCampaignHistoryItem>[] => [
      ...columns,
      {
        id: "report",
        header: <span className="sr-only">{t("campaign.history.columns.action")}</span>,
        align: "end",
        cell: (item) => button(item),
      },
    ],
    /** Karta (planshet / telefon) + pastida «Hisobot». */
    renderCard:
      (render: (item: SmsCampaignHistoryItem, index: number) => ReactNode) =>
      (item: SmsCampaignHistoryItem, index: number) => (
        <>
          {render(item, index)}
          {hasReport(item) ? <div className="px-4 pb-3">{button(item, true)}</div> : null}
        </>
      ),
    dialog: <CampaignReportDialog campaign={target} onClose={() => setTarget(null)} />,
  };
};
