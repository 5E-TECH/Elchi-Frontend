// dizayn-v2: superadmin-mails-today, admin-mails-today, manager-mails-today, registrator-mails-today, courier-mails-today, courier-mails-tab-switcher-open
import { memo, useCallback, useMemo, useState } from "react";
import { Inbox, Map as MapIcon, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import type { RootState } from "../../../app/config/store";
import { readBackendRejection } from "../../../shared/lib/backendReason";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Select, type SelectOption } from "../../../shared/ui/primitives";
import { getPostStatusBadge } from "../detail/lib/postStatus";
import { getMailTabPath } from "../lib/navigation";
import { hasMailBranch, selectMailsBranchColumn, useMailBranchName } from "../model/mailBranchNames";
import { useMailsCardView } from "../model/mailsCardView";
import type { MailsTabBodyProps } from "../model/mailsLayout";
import { toMailListRow, useTodayMails, type MailListRow } from "../model/mailsLists";
import { buildRegionFilterOptions } from "./lib/regionFilterOptions";
import MailsListBody from "./MailsListBody";

/**
 * «BUGUNGI POCHTALAR» — `/mails/today` (dizayn v2).
 *
 * Ma'lumot — `useTodayMails()` (kuryer: `post/on-the-road`; menejer: `post?status=sent&branch_id` + zaxira
 * `orders?status=on the road`; qolganlar: `post/new`). Viloyat filtri mijoz tomonida (v1 dagidek) va qidiruvli
 * (`Select searchable`, ega qarori 2026-11-09): maydonga yozib viloyat topiladi, ro'yxat qisqa bo'lsa ham.
 *
 *  - xodim (`card`, maket `superadmin-mails-today`): «Viloyat: Barchasi» + xulosa «N ta viloyat · …»,
 *    jadval. Kuryer ustuni — faqat backend bergan bo'lsa: YANGI pochtaga kuryer hali biriktirilmagan
 *    (`post/new` da `courier_id = '0'`, `courier` yo'q), shuning uchun odatda chizilmaydi; superadmin, admin va
 *    registratorda uning o'rnida «Filial» (`model/mailBranchNames.ts`) — xuddi shunday, faqat pochtada filial bo'lsa
 *    (YANGI pochta hali jo'natilmagan — `branch_id` yo'q);
 *  - menejer (`manager-mails-today`): kuryer ustunisiz, xulosa «N ta pochta», telefon kartasi «Pochta №X»;
 *  - kuryer (`page`, `courier-mails-today`): 3 ta `StatCard`, «Qabul qilinishi kerak» kartasi, saralanadigan
 *    jadval; telefonda filtr va xulosa kartadan oldin.
 *  - ega qarori 2026-11-03: kuryer va HQ bo'lmagan filial menejerida jadval o'rnida pochtalar kartalari
 *    (`MailCardsGrid`, `useMailsCardView`) — filtr, xulosa va `StatCard` lar o'z joyida; HQ menejeri — jadval.
 *
 * Holat — doim «Yangi» (info): bu ro'yxatdagi pochtalar hali qabul qilinmagan (v1 dagidek).
 * HQ bo'lmagan registratorda tab yo'q (`available: false`, qobiq qayta yo'naltiradi; bu yerda ham — to'g'ridan-to'g'ri
 * chizilsa xato emas, `/mails/return`). Eskirgan profil bilan baribir 403 `new_posts_hq_only` kelsa — kulrang
 * «Yangi pochtalar faqat HQ xodimlari uchun» holati (global xabarsiz: so'rov `silentError`).
 * Ochish: `/mails/:id` + `{ fromTab: "today", fallbackRegionId, fallbackRegionName, expectedOrderCount }`
 * (fix3: jo'natishda viloyat zaxirasi).
 */
const TodaysMails = ({ layout }: MailsTabBodyProps) => {
  const { t, i18n } = useTranslation(["mailsShell", "mails"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const role = useSelector((state: RootState) => state.role.role);
  const isManager = role === "manager";
  const cardView = useMailsCardView();
  const branchColumn = useSelector(selectMailsBranchColumn);
  const { isCourier, available, mails, query } = useTodayMails();
  const branchName = useMailBranchName(branchColumn && hasMailBranch(mails));
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
        toMailListRow(mail, {
          status,
          regionFallback: (id) => t("mails:regionFallback", { id }),
          branchName: branchColumn ? branchName : undefined,
        }),
      ),
    [branchColumn, branchName, filteredMails, status, t],
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
      searchable
      options={regionOptions}
      value={regionId}
      onChange={(value) => setRegionId(value ?? "")}
      className={className}
    />
  );

  const errorText = useCallback(
    (error: unknown) =>
      readBackendRejection(error).reason === "new_posts_hq_only"
        ? {
            title: t("common:coverage.new_posts_hq_only.title"),
            description: t("common:coverage.new_posts_hq_only.text"),
          }
        : null,
    [t],
  );

  if (!available) return <Navigate replace to={getMailTabPath("return")} />;

  return (
    <MailsListBody
      layout={layout}
      errorText={errorText}
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
        showCourier: !isCourier && !isManager && !branchColumn && rows.some((row) => Boolean(row.courierName)),
        showBranch: branchColumn && rows.some((row) => Boolean(row.branchName)),
        courierCards: isCourier,
        sortable: isCourier,
        linkOf,
        openLabel,
        ...(isManager ? { cardTitle: managerCardTitle, cardSub: managerCardSub } : {}),
      }}
      cards={cardView ? { showCourier: !isCourier } : undefined}
    />
  );
};

export default memo(TodaysMails);
