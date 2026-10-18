// dizayn-v2: courier-scan-package-detail, courier-scan-post-detail
import { useId, type ReactNode } from "react";
import { Calendar, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { CURRENCY_LABEL, formatMoneyLocalized, resolveMoneyLanguage } from "../../../shared/lib/formatMoney";
import { Card } from "../../../shared/ui/primitives";

export type ScanSummaryMeta = { key: string; icon: LucideIcon; label: string; value: string | null };

type ScanBatchSummaryProps = {
  /** Ekran o'quvchi sarlavhasi: «Paket ma'lumotlari» / «Pochta ma'lumotlari». */
  title: string;
  /** Chapdagi badge: paket holati yoki «N ta buyurtma». */
  badge: ReactNode;
  date: string | null;
  total: number;
  /** Qiymati yo'q (backend bermagan) qator chizilmaydi. */
  meta: ScanSummaryMeta[];
};

/**
 * Paket / pochta xulosasi (maket `courier-scan-package-detail`, `courier-scan-post-detail`): holat yoki son
 * badge'i + sana, «Jami summa», ostida ma'lumot qatorlari (filial, viloyat, haydovchi …).
 */
export const ScanBatchSummary = ({ title, badge, date, total, meta }: ScanBatchSummaryProps) => {
  const { t, i18n } = useTranslation("scan");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const titleId = useId();
  const shownDate = date ? formatDateTimeLocalized(date, { language }) : null;
  const items = meta.filter((item) => item.value);

  return (
    <Card padding="md" aria-labelledby={titleId} bodyClassName="flex flex-col gap-3">
      <h2 id={titleId} className="sr-only">
        {title}
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        {badge}
        {shownDate && shownDate !== "—" ? (
          <span className="ml-auto inline-flex items-center gap-1 whitespace-nowrap text-[13px] text-text-muted">
            <Calendar size={16} aria-hidden="true" />
            <span className="sr-only">{t("dateLabel")}</span>
            {shownDate}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-text-muted">{t("total")}</span>
        <span className="text-[28px] leading-9 font-bold tracking-[-.01em] text-text">
          {formatMoneyLocalized(total, { language, withCurrency: false })}
          <span className="ml-1 text-sm font-semibold tracking-normal text-text-muted">
            {CURRENCY_LABEL[resolveMoneyLanguage(language)]}
          </span>
        </span>
      </div>
      {items.length > 0 ? (
        <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-x-4 gap-y-3 border-t border-border pt-3">
          {items.map(({ key, icon: Icon, label, value }) => (
            <div key={key} className="flex min-w-0 flex-col gap-0.5">
              <dt className="inline-flex items-center gap-1.5 text-xs text-text-muted">
                <Icon size={14} aria-hidden="true" className="shrink-0" />
                {label}
              </dt>
              <dd className="m-0 min-w-0 font-semibold wrap-break-word text-text">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </Card>
  );
};
