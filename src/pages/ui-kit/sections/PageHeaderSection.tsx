import type { ReactNode } from "react";
import { Check, Clock, Copy, Download, Plus, RefreshCw, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OrderStatusBadge } from "../../../entities/order/ui/OrderStatusBadge";
import { copyToClipboard } from "../../../shared/lib/clipboard";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Badge } from "../../../shared/ui/primitives/Badge";
import { Button } from "../../../shared/ui/primitives/Button";
import { IconButton } from "../../../shared/ui/primitives/IconButton";
import { PageHeader } from "../../../shared/ui/primitives/PageHeader";
import { Spinner } from "../../../shared/ui/primitives/Spinner";
import { KitSection } from "../KitSection";
import { ThemePair } from "../ThemePair";

/** Namunadagi «orqaga» havolasi shu bo'limning o'ziga olib keladi (sahifadan chiqarmaydi). */
const SELF_ROUTE = "/ops/ui-kit?section=page-header";

const Sample = ({ caption, children }: { caption: string; children: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-4 py-5 first:pt-0 last:pb-0">
    <p className="text-[13px] font-semibold text-text-muted">{caption}</p>
    {children}
  </div>
);

/**
 * «Sahifa sarlavhasi» bo'limi — `PageHeader` namunalari (kunduzgi + tungi).
 * Matn va tuzilma maketlardan: `superadmin-orders-list` (izoh + 2 amal),
 * `superadmin-orders-detail` (orqaga havolasi), `manager-orders-detail`
 * (nusxalash, holat, «Bekor qilish» + «Sotish»), `manager-branch-dashboard-main` (faqat sarlavha),
 * `superadmin-orders-list-refreshing` (`grow`: sarlavha yonida «Yangilanmoqda…», telefonda o'ng chetdagi
 * ikonka tugma — `meta` ichida `ml-auto`; desktopda ghost «Yangilash»).
 */
export const PageHeaderSection = () => {
  const { t, i18n } = useTranslation("ui");
  const ordersTitle = t("pageHeader.demo.ordersTitle");

  const copyAction = (number: string) => (
    <IconButton
      size="sm"
      icon={Copy}
      label={t("pageHeader.demo.copyNumber")}
      onClick={() => void copyToClipboard(number)}
    />
  );

  return (
    <KitSection
      id="page-header"
      title={t("kit.sections.pageHeader.title")}
      description={t("kit.sections.pageHeader.description")}
    >
      <ThemePair>
        <div className="flex min-w-0 flex-col divide-y divide-border">
          <Sample caption={t("pageHeader.samples.simple")}>
            <PageHeader title={t("pageHeader.demo.dashboardTitle")} />
          </Sample>

          <Sample caption={t("pageHeader.samples.description")}>
            <PageHeader
              title={ordersTitle}
              description={t("pageHeader.demo.ordersTotal", {
                total: formatNumberLocalized(1248, { language: i18n.language }),
              })}
              actions={
                <>
                  <Button variant="secondary" leftIcon={Download} compact>
                    {t("pageHeader.demo.exportExcel")}
                  </Button>
                  <Button leftIcon={Plus} compact>{t("pageHeader.demo.createOrder")}</Button>
                </>
              }
            />
          </Sample>

          <Sample caption={t("pageHeader.samples.back")}>
            <PageHeader
              back={SELF_ROUTE}
              backLabel={ordersTitle}
              title={t("pageHeader.demo.orderNumber", { number: "10241" })}
              description={t("pageHeader.demo.createdToday")}
            />
          </Sample>

          <Sample caption={t("pageHeader.samples.meta")}>
            <PageHeader
              back={SELF_ROUTE}
              backLabel={ordersTitle}
              title={t("pageHeader.demo.orderNumber", { number: "10305" })}
              titleAction={copyAction("10305")}
              meta={<OrderStatusBadge status="waiting" />}
              description={t("pageHeader.demo.createdYesterday")}
              actions={
                <>
                  <Button variant="danger-soft" leftIcon={X}>
                    {t("pageHeader.demo.cancel")}
                  </Button>
                  <Button leftIcon={Check}>{t("pageHeader.demo.sell")}</Button>
                </>
              }
            />
          </Sample>

          <Sample caption={t("pageHeader.samples.refresh")}>
            <PageHeader
              grow
              title={ordersTitle}
              meta={
                <>
                  <Badge role="status">
                    <Spinner className="size-3! border-[1.5px]!" />
                    {t("pageHeader.demo.refreshing")}
                  </Badge>
                  <IconButton
                    variant="secondary"
                    icon={RefreshCw}
                    label={t("pageHeader.demo.refreshList")}
                    loading
                    className="ml-auto md:hidden"
                  />
                </>
              }
              description={
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>
                    {t("pageHeader.demo.ordersTotal", {
                      total: formatNumberLocalized(1248, { language: i18n.language }),
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <Clock size={14} aria-hidden="true" className="text-text-subtle" />
                    {t("pageHeader.demo.lastUpdated")}
                  </span>
                </span>
              }
              actions={
                <>
                  <Button variant="ghost" compact leftIcon={RefreshCw} loading className="max-md:hidden">
                    {t("pageHeader.demo.refresh")}
                  </Button>
                  <Button variant="secondary" leftIcon={Download} compact>
                    {t("pageHeader.demo.exportExcel")}
                  </Button>
                </>
              }
            />
          </Sample>

          <Sample caption={t("pageHeader.samples.long")}>
            <PageHeader
              back={SELF_ROUTE}
              backLabel={t("pageHeader.demo.cancelledTitle")}
              title={t("pageHeader.demo.longTitle")}
              description={t("pageHeader.demo.longDescription")}
              actions={
                <>
                  <Button variant="secondary" leftIcon={Download} compact>
                    {t("pageHeader.demo.exportExcel")}
                  </Button>
                  <Button leftIcon={Plus} compact>{t("pageHeader.demo.createOrder")}</Button>
                </>
              }
            />
          </Sample>
        </div>
      </ThemePair>
    </KitSection>
  );
};
