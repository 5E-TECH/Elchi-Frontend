// dizayn-v2: superadmin-mails-today, admin-mails-today, manager-mails-today, registrator-mails-today, courier-mails-today, courier-mails-tab-switcher-open
import { memo, useCallback, useMemo, useState } from "react";
import { Inbox, Map as MapIcon, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Select, type SelectOption } from "../../../shared/ui/primitives";
import { getPostStatusBadge } from "../detail/lib/postStatus";
import type { MailsTabBodyProps } from "../model/mailsLayout";
import { toMailListRow, useTodayMails, type MailListRow } from "../model/mailsLists";
import { buildRegionFilterOptions } from "./lib/regionFilterOptions";
import MailsListBody from "./MailsListBody";

/**
 * «BUGUNGI POCHTALAR» — `/mails/today` (dizayn v2).
 *
 * Ma'lumot — `useTodayMails()` (kuryer: `post/on-the-road`; menejer: `post?status=sent&branch_id` + zaxira
 * `orders?status=on the road`; qolganlar: `post/new`). Viloyat filtri mijoz tomonida (v1 dagidek).
 *
 *  - xodim (`card`, maket `superadmin-mails-today`): «Viloyat: Barchasi» + xulosa «N ta viloyat · …»,
 *    jadval. Kuryer ustuni — faqat backend bergan bo'lsa: YANGI pochtaga kuryer hali biriktirilmagan
 *    (`post/new` da `courier_id = '0'`, `courier` yo'q), shuning uchun odatda chizilmaydi;
 *  - menejer (`manager-mails-today`): kuryer ustunisiz, xulosa «N ta pochta», telefon kartasi «Pochta №X»;
 *  - kuryer (`page`, `courier-mails-today`): 3 ta `StatCard`, «Qabul qilinishi kerak» kartasi, saralanadigan
 *    jadval; telefonda filtr va xulosa kartadan oldin.
 *
 * Holat — doim «Yangi» (info): bu ro'yxatdagi pochtalar hali qabul qilinmagan (v1 dagidek).
 * Ochish: `/mails/:id` + `{ fromTab: "today", fallbackRegionId, fallbackRegionName, expectedOrderCount }`
 * (fix3: jo'natishda viloyat zaxirasi).
 */
const TodaysMails = ({ layout }: MailsTabBodyProps) => {
  const { t, i18n } = useTranslation(["mailsShell", "mails"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const role = useSelector((state: RootState) => state.role.role);
  const isManager = role === "manager";
  const { isCourier, mails, query } = useTodayMails();
  const [regionId, setRegionId] = useState("");

  const regionOptions = useMemo<SelectOption[]>(
    () => [{ value: "", label: t("filter.all") }, ...buildRegionFilterOptions(mails)],
    [mails, t],
  );
  const filteredMails = useMemo(
    () => (regionId ? mails.filter((mail) => mail.region?.id === regionId) : mails),
    [mails, regionId],
  );

  const status = useMemo(() => {
    const badge = getPostStatusBadge("new");
    return badge ? { tone: badge.tone, label: t(`mails:${badge.labelKey}`) } : null;
  }, [t]);
  const rows = useMemo(
    () =>
      filteredMails.map((mail) =>
        toMailListRow(mail, { status, regionFallback: (id) => t("mails:regionFallback", { id }) }),
      ),
    [filteredMails, status, t],
  );

  const linkOf = useCallback(
    (row: MailListRow) => ({
      to: `/mails/${row.id}`,
      state: {
        fromTab: "today",
        fallbackRegionId: row.regionId,
        fallbackRegionName: row.regionName,
        expectedOrderCount: row.orders,
      },
    }),
    [],
  );
  const openLabel = useCallback(
    (row: MailListRow) => t(isCourier ? "openCourierMail" : "openMail", { id: row.displayId }),
    [isCourier, t],
  );

  // Menejer telefon kartasi: «Pochta №2493» / «Samarqand · 6 ta buyurtma · Bugun, 13:10».
  const managerCardTitle = useCallback((row: MailListRow) => t("mailTitle", { id: row.displayId }), [t]);
  const managerCardSub = useCallback(
    (row: MailListRow) => (
      <>
        {row.regionName} ·{" "}
        {t("table.ordersSub", { count: row.orders, value: formatNumberLocalized(row.orders, { language }) })} ·{" "}
        <span className="whitespace-nowrap">{formatDateTimeLocalized(row.createdAt, { language })}</span>
      </>
    ),
    [language, t],
  );

  const regionSelect = (className: string) => (
    <Select
      aria-label={t("filter.region")}
      inlineLabel={t("filter.region")}
      icon={isCourier ? MapIcon : MapPin}
      options={regionOptions}
      value={regionId}
      onChange={(value) => setRegionId(value ?? "")}
      className={className}
    />
  );

  return (
    <MailsListBody
      layout={layout}
      query={query}
      rows={rows}
      onClearFilter={regionId ? () => setRegionId("") : undefined}
      ariaLabel={t("tabs.today.title")}
      loadingLabel={t("today.loading")}
      empty={{ icon: Inbox, title: t("mails:emptyToday") }}
      filterEmptyTitle={t("mails:oldRegionFilterEmpty")}
      summaryUnit={isManager ? "mails" : "regions"}
      toolbarStart={<div className="min-w-0 flex-[1_1_260px]">{regionSelect("w-full")}</div>}
      summaryGrow
      statsLabel={t("tabs.today.title")}
      courierHead={{
        title: t("today.courierTitle"),
        description: t("today.courierDescription"),
        action: <div className="min-w-[200px] flex-[0_1_260px]">{regionSelect("w-full")}</div>,
      }}
      phoneTop={regionSelect("w-full")}
      table={{
        idHeader: t("table.mail"),
        showCourier: !isCourier && !isManager && rows.some((row) => Boolean(row.courierName)),
        courierCards: isCourier,
        sortable: isCourier,
        linkOf,
        openLabel,
        ...(isManager ? { cardTitle: managerCardTitle, cardSub: managerCardSub } : {}),
      }}
    />
  );
};

export default memo(TodaysMails);
