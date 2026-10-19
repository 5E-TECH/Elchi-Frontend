// dizayn-v2: (maket yo'q) courier-scan-package-detail
import { memo, useId, useMemo, type ReactNode } from "react";
import { Inbox, PackageOpen, QrCode, ScanLine } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { canReceiveExternalOrders } from "../../../app/lib/access";
import { OrderStatusBadge } from "../../../entities/order";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Badge, Card, DataTable, EmptyState, buttonClasses, type DataTableColumn } from "../../../shared/ui/primitives";
import { SCANNER_ROUTE } from "../model/routes";
import { buildExternalBagView, type ExternalBagMember } from "../model/scanExternalBagView";
import { useIsBelowLg, useIsBelowMd } from "../model/useViewport";
import { ScanActionCard } from "./ScanActionCard";
import { ScanResultHeader } from "./ScanResultHeader";
import { ScanStickyBar } from "./ScanStickyBar";

/** Tashqi posilkalarni qabul qilish — manba (market) tanlash, keyin qop yorlig'i skanerlanadi. */
const INCOMING_ROUTE = "/new-orders/incoming";

/**
 * Skanerlangan TASHQI QOP yorlig'i (BeePost; Trello CyCV4XHR) — maket yo'q, eng yaqini
 * `courier-scan-package-detail` (sarlavha, xulosa kartasi, ichidagi ro'yxat, amal kartasi / pastki panel).
 *
 * Qop — buyurtma emas: ichida N ta posilka. Javobda mijoz ma'lumoti va market YO'Q (backend ataylab PII
 * bermaydi), shuning uchun ro'yxatda faqat raqam, QR kod va holat. Qabul qilish bu yerda emas — «Kiruvchi
 * posilkalar» sahifasida (`receive-by-scan` qop tokenini a'zolariga o'zi yoyadi); u faqat qabul qila oladigan
 * rollarga (`canReceiveExternalOrders`) ko'rinadi.
 */
const ScanExternalBagDetail = ({ data, topNotice }: { data: unknown; topNotice?: ReactNode }) => {
  const { t, i18n } = useTranslation("scan");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isBelowLg = useIsBelowLg();
  const isPhone = useIsBelowMd();
  const canReceive = useSelector(canReceiveExternalOrders);
  const summaryId = useId();
  const view = useMemo(() => buildExternalBagView(data), [data]);
  if (!view) return null;

  const countText = t("bag.parcels", { count: view.count, value: formatNumberLocalized(view.count, { language }) });
  const title = t("bag.title");

  const openLink = (block: boolean) => (
    <Link to={INCOMING_ROUTE} className={buttonClasses({ variant: "primary", size: "lg", fullWidth: block })}>
      <Inbox size={18} aria-hidden="true" className="shrink-0" />
      <span className="min-w-0 truncate">{t("bag.open")}</span>
    </Link>
  );
  const backLink = (
    <Link to={SCANNER_ROUTE} className={buttonClasses({ variant: "secondary", size: "lg" })}>
      <ScanLine size={18} aria-hidden="true" className="shrink-0" />
      <span className="min-w-0 truncate">{t("backToScanner")}</span>
    </Link>
  );

  let aside: ReactNode = null;
  let sticky: ReactNode = null;
  if (canReceive && !isBelowLg) {
    aside = (
      <ScanActionCard title={t("bag.actionTitle")} text={t("bag.actionText")}>
        {openLink(true)}
      </ScanActionCard>
    );
  } else if (canReceive) {
    sticky = (
      <ScanStickyBar summary={{ title, sub: countText }}>
        {openLink(false)}
      </ScanStickyBar>
    );
  } else if (isPhone) {
    sticky = <ScanStickyBar>{backLink}</ScanStickyBar>;
  }

  const columns: DataTableColumn<ExternalBagMember>[] = [
    {
      id: "order",
      header: t("table.order"),
      cell: (row) => <span className="font-semibold whitespace-nowrap">{row.id ? `№${row.id}` : "—"}</span>,
    },
    {
      id: "qr",
      header: t("bag.qrColumn"),
      cell: (row) => <span className="text-[13px] [overflow-wrap:anywhere] text-text-muted">{row.token ?? "—"}</span>,
    },
    {
      id: "status",
      header: t("table.status"),
      cell: (row) => (row.status ? <OrderStatusBadge status={row.status} /> : <span className="text-text-muted">—</span>),
    },
  ];

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <ScanResultHeader
        icon={PackageOpen}
        title={title}
        phoneTitle={title}
        phoneSub={t("bag.phoneSub")}
        sub={t("bag.sub")}
        alertText={t("bag.alertText")}
      />
      {topNotice}
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <Card padding="md" aria-labelledby={summaryId} bodyClassName="flex flex-col gap-3">
            <h2 id={summaryId} className="sr-only">
              {t("bag.summary")}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{countText}</Badge>
              {view.pending > 0 ? (
                <Badge tone="info" dot>
                  {t("bag.pending", { count: view.pending, value: formatNumberLocalized(view.pending, { language }) })}
                </Badge>
              ) : null}
            </div>
            {view.token ? (
              <dl className="m-0 flex min-w-0 flex-col gap-0.5 border-t border-border pt-3">
                <dt className="inline-flex items-center gap-1.5 text-xs text-text-muted">
                  <QrCode size={14} aria-hidden="true" className="shrink-0" />
                  {t("bag.token")}
                </dt>
                <dd className="m-0 font-semibold [overflow-wrap:anywhere] text-text">{view.token}</dd>
              </dl>
            ) : null}
          </Card>
          <Card
            padding="none"
            title={t("bag.membersTitle")}
            titleAddon={<Badge>{t("quantity", { count: view.count, value: formatNumberLocalized(view.count, { language }) })}</Badge>}
          >
            {view.members.length === 0 ? (
              <EmptyState icon={PackageOpen} title={t("bag.membersEmpty")} />
            ) : (
              <DataTable
                label={t("bag.membersTitle")}
                rows={view.members}
                columns={columns}
                getRowKey={(row, index) => `${row.id ?? row.token ?? "row"}-${index}`}
                cardsLabel={t("bag.membersTitle")}
                renderCard={(row) => (
                  <div className="flex min-w-0 flex-col gap-1 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-semibold text-text">{row.id ? `№${row.id}` : "—"}</span>
                      {row.status ? <OrderStatusBadge status={row.status} /> : null}
                    </div>
                    {row.token ? (
                      <span className="text-[13px] [overflow-wrap:anywhere] text-text-muted">{row.token}</span>
                    ) : null}
                  </div>
                )}
              />
            )}
          </Card>
        </div>
        {aside ? (
          <aside aria-label={t("bag.actionTitle")} className="min-w-0 flex-[1_1_360px]">
            {aside}
          </aside>
        ) : null}
      </div>
      {sticky}
    </div>
  );
};

export default memo(ScanExternalBagDetail);
