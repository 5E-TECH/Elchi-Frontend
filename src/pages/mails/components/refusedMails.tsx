// dizayn-v2: superadmin-mails-refused, admin-mails-refused, manager-mails-refused, registrator-mails-refused, courier-mails-refused, courier-mails-tab-switcher-open
import { memo, useCallback, useMemo } from "react";
import { Info, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TONE_SOFT } from "../../../shared/ui/primitives";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { getPostStatusBadge } from "../detail/lib/postStatus";
import type { MailsTabBodyProps } from "../model/mailsLayout";
import { toMailListRow, useRefusedMails, type MailListRow } from "../model/mailsLists";
import MailsListBody from "./MailsListBody";

/**
 * «RAD ETILGAN POCHTALAR» — `/mails/refused` (dizayn v2).
 *
 * Ma'lumot — `useRefusedMails()` (kuryer: `post/courier/rejected`; qolganlar: `post/rejected`, backend
 * kuryer nomini ham beradi). Filtr yo'q.
 *
 *  - xodim (`card`, maketlar `superadmin-mails-refused`, `admin-`/`manager-mails-refused`): izoh «Kuryer
 *    qaytargan pochtalar…» + xulosa, jadval (Kuryer ustuni bilan), holat «Rad etilgan» (danger);
 *  - kuryer (`page`, `courier-mails-refused`): «faqat ko'rish» izohi, 3 ta `StatCard`, «Rad etilgan pochtalar»
 *    kartasi, saralanadigan jadval. Qabulni filial bajaradi — kuryer tafsilotda faqat o'qiydi.
 *
 * Ochish: `/mails/:id` + `{ fromTab: "refused", type: "refused", fallbackRegionId, fallbackRegionName,
 * expectedOrderCount }` (v1 dagidek).
 */
const RefusedMails = ({ layout }: MailsTabBodyProps) => {
  const { t, i18n } = useTranslation(["mailsShell", "mails"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { isCourier, mails, query } = useRefusedMails();

  const status = useMemo(() => {
    const badge = getPostStatusBadge("canceled");
    return badge ? { tone: badge.tone, label: t(`mails:${badge.labelKey}`) } : null;
  }, [t]);
  const rows = useMemo(
    () =>
      mails.map((mail) => toMailListRow(mail, { status, regionFallback: (id) => t("mails:regionFallback", { id }) })),
    [mails, status, t],
  );

  const linkOf = useCallback(
    (row: MailListRow) => ({
      to: `/mails/${row.id}`,
      state: {
        fromTab: "refused",
        type: "refused",
        fallbackRegionId: row.regionId,
        fallbackRegionName: row.regionName,
        expectedOrderCount: row.orders,
      },
    }),
    [],
  );
  const openLabel = useCallback(
    (row: MailListRow) => t(isCourier ? "openCourierMail" : "refused.open", { id: row.displayId }),
    [isCourier, t],
  );

  // Kuryer telefon kartasi nomi (maket `courier-mails-refused`): «Rad etilgan pochta №2476, viloyat, sana,
  // N ta buyurtma, summa — ochish». Xodim kartasida nom kartaning o'z matnidan olinadi.
  const courierCardLabel = useCallback(
    (row: MailListRow) =>
      t("refused.cardLabel", {
        id: row.displayId,
        region: row.regionName,
        date: formatDateTimeLocalized(row.createdAt, { language }),
        orders: t("table.ordersSub", { count: row.orders, value: formatNumberLocalized(row.orders, { language }) }),
        amount: formatMoneyLocalized(row.amount, { language }),
      }),
    [language, t],
  );

  // Kuryer izohi (`.el-alert.el-tone-info`): ikonka ton rangida, matn neytral.
  const note = (
    <div role="note" className={cx("flex items-start gap-3 rounded-xl px-4 py-3", TONE_SOFT.info)}>
      <Info aria-hidden="true" size={18} strokeWidth={2} className="mt-px shrink-0" />
      <p className="min-w-0 text-[13px] text-text">{t("refused.courierNote")}</p>
    </div>
  );

  return (
    <MailsListBody
      layout={layout}
      query={query}
      rows={rows}
      ariaLabel={t("tabs.refused.title")}
      loadingLabel={t("refused.loading")}
      empty={{ icon: TriangleAlert, title: t("mails:emptyRefused") }}
      summaryUnit="regions"
      toolbarStart={<p className="min-w-0 flex-[1_1_320px] text-[13px] text-text-muted">{t("refused.hint")}</p>}
      statsLabel={t("tabs.refused.title")}
      courierHead={{ title: t("tabs.refused.title"), description: t("refused.courierDescription") }}
      note={note}
      table={{
        idHeader: t("table.mail"),
        showCourier: !isCourier,
        courierCards: isCourier,
        sortable: isCourier,
        linkOf,
        openLabel,
        ...(isCourier ? { cardLabel: courierCardLabel } : {}),
      }}
    />
  );
};

export default memo(RefusedMails);
