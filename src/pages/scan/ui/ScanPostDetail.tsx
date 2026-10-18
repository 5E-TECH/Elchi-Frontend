// dizayn-v2: courier-scan-post-detail
import { memo, useMemo, type ReactNode } from "react";
import { Mail, MapPin, ScanLine, Truck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { canViewMails } from "../../../app/lib/access";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Badge, buttonClasses } from "../../../shared/ui/primitives";
import { mailDetailRoute, SCANNER_ROUTE } from "../model/routes";
import { buildScanPostView } from "../model/scanBatchView";
import { useIsBelowLg, useIsBelowMd } from "../model/useViewport";
import { ScanActionCard } from "./ScanActionCard";
import { ScanBatchSummary } from "./ScanBatchSummary";
import { ScanOrdersCard } from "./ScanOrdersCard";
import { ScanResultHeader } from "./ScanResultHeader";
import { ScanStickyBar } from "./ScanStickyBar";

interface ScanPostDetailProps {
  data: unknown;
  topNotice?: ReactNode;
}

/**
 * Skanerlangan pochta (`PST-…`) — maket `courier-scan-post-detail`. Pochta bilan ish (qabul, holatlar) —
 * pochta sahifasida: «Pochtani ochish» → `/mails/:id`, faqat `/mails` ochiq rollarga (`canViewMails`);
 * aks holda amal kartasi yo'q. `GET post/scan/:id` buyurtmalar ro'yxatini bermasa — karta chizilmaydi.
 */
const ScanPostDetail = ({ data, topNotice }: ScanPostDetailProps) => {
  const { t, i18n } = useTranslation("scan");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isBelowLg = useIsBelowLg();
  const isPhone = useIsBelowMd();
  const canOpenMail = useSelector(canViewMails);
  const view = useMemo(() => buildScanPostView(data), [data]);
  if (!view) return null;

  const title = t("post.title", { id: view.id });
  const ordersText = t("ordersCount", { count: view.ordersCount, value: formatNumberLocalized(view.ordersCount, { language }) });
  // Telefon panelida ikki tugma yonma-yon — ixcham chekka, ikonkasiz: matn kesilmaydi.
  const compact = isPhone && canOpenMail;
  const openLink = (block: boolean) => (
    <Link
      to={mailDetailRoute(view.id)}
      className={buttonClasses({ variant: "primary", size: "lg", fullWidth: block, compact: compact && !block })}
    >
      {compact && !block ? null : <Mail size={18} aria-hidden="true" className="shrink-0" />}
      <span className="min-w-0 truncate">{t("post.open")}</span>
    </Link>
  );
  const backLink = (
    <Link to={SCANNER_ROUTE} className={buttonClasses({ variant: "secondary", size: "lg", compact })}>
      {compact ? null : <ScanLine size={18} aria-hidden="true" className="shrink-0" />}
      <span className="min-w-0 truncate">{t("backToScanner")}</span>
    </Link>
  );

  let aside: ReactNode = null;
  let sticky: ReactNode = null;
  if (canOpenMail && !isBelowLg) {
    aside = (
      <ScanActionCard title={t("post.actionTitle")} text={t("post.actionText")}>
        {openLink(true)}
      </ScanActionCard>
    );
  } else if (canOpenMail) {
    sticky = (
      <ScanStickyBar
        summary={{
          title: t("post.summaryLine", { id: view.id, orders: ordersText }),
          sub: [formatMoneyLocalized(view.total, { language }), view.region].filter(Boolean).join(" · "),
        }}
      >
        {isPhone ? backLink : null}
        {openLink(false)}
      </ScanStickyBar>
    );
  } else if (isPhone) {
    sticky = <ScanStickyBar>{backLink}</ScanStickyBar>;
  }

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <ScanResultHeader
        icon={Mail}
        title={title}
        phoneTitle={title}
        phoneSub={t("post.phoneSub")}
        sub={t("post.sub")}
        alertText={t("post.alertText")}
      />
      {topNotice}
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <ScanBatchSummary
            title={t("post.summary")}
            badge={<Badge>{ordersText}</Badge>}
            date={view.createdAt}
            total={view.total}
            meta={[
              { key: "region", icon: MapPin, label: t("post.region"), value: view.region },
              { key: "courier", icon: Truck, label: t("post.courier"), value: view.courier },
            ]}
          />
          {view.orders ? (
            <ScanOrdersCard
              title={t("post.ordersTitle")}
              rows={view.orders}
              count={view.ordersCount}
              emptyText={t("post.ordersEmpty")}
            />
          ) : null}
        </div>
        {aside ? (
          <aside aria-label={t("post.actionTitle")} className="min-w-0 flex-[1_1_360px]">
            {aside}
          </aside>
        ) : null}
      </div>
      {sticky}
    </div>
  );
};

export default memo(ScanPostDetail);
