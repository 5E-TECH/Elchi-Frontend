// dizayn-v2: superadmin-mails-today, admin-mails-today, manager-mails-today, registrator-mails-today, courier-mails-today, courier-mails-tab-switcher-open, superadmin-mails-refused, admin-mails-refused, manager-mails-refused, registrator-mails-refused, courier-mails-refused
import { memo, useEffect, useMemo } from "react";
import { Clock, Package, RotateCcw, TriangleAlert, type LucideIcon } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/config/store";
import { cx } from "../../shared/lib/cx";
import { formatNumberLocalized } from "../../shared/lib/formatMoney";
import { Card, PageHeader, Select, Tabs, type SelectOption, type TabItem } from "../../shared/ui/primitives";
import { useIsPhone } from "../../shared/ui/primitives/date/useIsPhone";
import OldMails from "./components/oldMails";
import RefusedMails from "./components/refusedMails";
import ReturnMails from "./components/returnMails";
import TodaysMails from "./components/todaysMails";
import { getMailTabPath, normalizeMailTab, type MailTab } from "./lib/navigation";
import type { MailsTabLayout } from "./model/mailsLayout";
import { useRefusedMails, useReturnRequestsCount, useTodayMails } from "./model/mailsLists";

/**
 * «POCHTA» QOBIG'I — `/mails/:tab` (dizayn v2).
 *
 * Sarlavha «Pochta» + rolga qarab izoh, tablar (havola rejimi: har tab — alohida route) va faol tab tanasi.
 *  - xodim (superadmin, admin, manager, registrator): bitta `Card padding="none"`, ichida tablar «Bugungi ⟨son⟩ ·
 *    Qaytarish ⟨son⟩ · Rad etilgan ⟨son⟩ · Eski» va tana (`layout="card"`). Telefonda tablar o'rnida bo'lim
 *    tanlagichi (`Select`, «Pochta bo'limi: …»). Maketlar `*-mails-today`, `*-mails-refused`.
 *  - kuryer: tablar sahifa fonida (karta ustida), «Qaytarish» tabi yo'q; telefonda to'liq enli qisqa tablar.
 *    Tana o'z bo'limlarini chizadi (`layout="page"`). Maketlar `courier-mails-*`.
 *
 * Sonlar tab tanalari ishlatadigan o'sha hooklardan (`model/mailsLists.ts`) — queryKey bir xil, qo'shimcha
 * so'rov yo'q. «Eski» sonsiz (ro'yxat filtr va sahifaga bog'liq).
 *
 * Saqlangan xatti-harakatlar (v1): `/mails` va eski `?tab=x` → `/mails/x`; kuryer `/mails/return` (va
 * `?tab=return`) → `/mails/today`; tab almashganda URL parametrlari tushadi (tab havolasi parametrsiz);
 * `batch_mode` faqat admin va superadmin uchun — boshqa rolda URL'dan olib tashlanadi.
 */

const TAB_ICON: Record<MailTab, LucideIcon> = {
  today: Package,
  return: RotateCcw,
  refused: TriangleAlert,
  old: Clock,
};

const STAFF_TABS: readonly MailTab[] = ["today", "return", "refused", "old"];
const COURIER_TABS: readonly MailTab[] = ["today", "refused", "old"];

type MailCounts = Partial<Record<MailTab, number>>;

/** Tab sonidagi belgi (`.el-tab-count`, faol — ko'k). */
const COUNT_BADGE =
  "inline-flex h-5 min-w-[22px] items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums";
const COUNT_ACTIVE = "bg-action-soft text-action-fg";
const COUNT_IDLE = "bg-sunken text-text-muted";

const TabBody = ({ tab, layout, canUseReturnTab }: { tab: MailTab; layout: MailsTabLayout; canUseReturnTab: boolean }) => (
  <>
    {tab === "today" && <TodaysMails layout={layout} />}
    {canUseReturnTab && tab === "return" && <ReturnMails layout={layout} />}
    {tab === "refused" && <RefusedMails layout={layout} />}
    {tab === "old" && <OldMails layout={layout} />}
  </>
);

/**
 * Telefondagi bo'lim tanlagichi (maket `superadmin-mails-today` telefonda): ikonka, bo'lim nomi va soni;
 * tanlansa — o'sha tab route'iga o'tadi.
 */
const MailSectionSelect = ({ tabs, active, counts }: { tabs: readonly MailTab[]; active: MailTab; counts: MailCounts }) => {
  const { t, i18n } = useTranslation("mailsShell");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const options = useMemo<SelectOption<MailTab>[]>(
    () => tabs.map((tab) => ({ value: tab, label: t(`tabs.${tab}.title`), icon: TAB_ICON[tab] })),
    [t, tabs],
  );
  const countBadge = (tab: MailTab, selected: boolean) => {
    const count = counts[tab];
    if (count === undefined) return null;
    return (
      <span className={cx(COUNT_BADGE, selected ? COUNT_ACTIVE : COUNT_IDLE)}>
        {formatNumberLocalized(count, { language })}
      </span>
    );
  };

  return (
    <div className="border-b border-border px-4 py-3">
      <Select<MailTab>
        aria-label={t("sectionLabel", { section: t(`tabs.${active}.title`) })}
        icon={TAB_ICON[active]}
        options={options}
        value={active}
        onChange={(value) => {
          if (value && value !== active) navigate(getMailTabPath(value));
        }}
        valueAddon={countBadge(active, true)}
        renderOption={(option, state) => (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="min-w-0 truncate">{option.label}</span>
            {countBadge(option.value, state.selected)}
          </span>
        )}
        className="font-semibold"
      />
    </div>
  );
};

/** Xodim qobig'i: sarlavha + bitta karta (tablar / telefonda bo'lim tanlagichi + tana). */
const StaffMailsShell = ({ activeTab, isManager }: { activeTab: MailTab; isManager: boolean }) => {
  const { t } = useTranslation("mailsShell");
  const isPhone = useIsPhone();
  const today = useTodayMails();
  const refused = useRefusedMails();
  const returnCount = useReturnRequestsCount();

  const counts: MailCounts = {
    today: today.isLoaded ? today.mails.length : undefined,
    return: returnCount,
    refused: refused.isLoaded ? refused.mails.length : undefined,
  };
  const items: TabItem<MailTab>[] = STAFF_TABS.map((tab) => ({
    value: tab,
    label: t(`tabs.${tab}.short`),
    title: t(`tabs.${tab}.title`),
    count: counts[tab],
    to: getMailTabPath(tab),
  }));

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader title={t("title")} description={t(isManager ? "description.manager" : "description.staff")} />
      <Card as="section" padding="none" aria-label={t(`tabs.${activeTab}.title`)}>
        {isPhone ? (
          <MailSectionSelect tabs={STAFF_TABS} active={activeTab} counts={counts} />
        ) : (
          <Tabs items={items} value={activeTab} ariaLabel={t("tabsLabel")} listClassName="px-3" />
        )}
        <TabBody tab={activeTab} layout="card" canUseReturnTab />
      </Card>
    </div>
  );
};

/** Kuryer qobig'i: sarlavha, sahifa fonidagi tablar (telefonda to'liq enli, qisqa nomlar) va tana. */
const CourierMailsShell = ({ activeTab }: { activeTab: MailTab }) => {
  const { t } = useTranslation("mailsShell");
  const isPhone = useIsPhone();
  const today = useTodayMails();
  const refused = useRefusedMails();

  const counts: MailCounts = {
    today: today.isLoaded ? today.mails.length : undefined,
    refused: refused.isLoaded ? refused.mails.length : undefined,
  };
  const items: TabItem<MailTab>[] = COURIER_TABS.map((tab) => ({
    value: tab,
    label: t(isPhone ? `tabs.${tab}.short` : `tabs.${tab}.title`),
    title: t(`tabs.${tab}.title`),
    count: counts[tab],
    to: getMailTabPath(tab),
  }));

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader title={t("title")} description={isPhone ? undefined : t("description.courier")} />
      <Tabs items={items} value={activeTab} ariaLabel={t("tabsLabel")} background="bg" fullWidth={isPhone} />
      <TabBody tab={activeTab} layout="page" canUseReturnTab={false} />
    </div>
  );
};

const Mails = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const role = useSelector((state: RootState) => state.role.role);
  const isCourier = role === "courier";
  const canUseReturnTab = !isCourier;
  const canUseOldBatchMode = role === "admin" || role === "superadmin";
  const tabParam = new URLSearchParams(location.search).get("tab");
  const activeTab = normalizeMailTab(location.pathname.split("/").filter(Boolean).at(-1));
  const selectedBatchMode = new URLSearchParams(location.search).get("batch_mode") ?? "";

  // «Filial paketlari» rejimi (`batch_mode`) faqat admin va superadmin uchun — boshqa rolda URL'dan olinadi.
  useEffect(() => {
    if (canUseOldBatchMode || !selectedBatchMode) return;
    const params = new URLSearchParams(location.search);
    params.delete("batch_mode");
    navigate(`${location.pathname}${params.toString() ? `?${params.toString()}` : ""}`, { replace: true });
  }, [canUseOldBatchMode, selectedBatchMode, location.pathname, location.search, navigate]);

  if (tabParam) {
    return <Navigate replace to={getMailTabPath(!canUseReturnTab && tabParam === "return" ? "today" : tabParam)} />;
  }

  if (location.pathname === "/mails" || (!canUseReturnTab && activeTab === "return")) {
    return <Navigate replace to={getMailTabPath("today")} />;
  }

  return isCourier ? (
    <CourierMailsShell activeTab={activeTab} />
  ) : (
    <StaffMailsShell activeTab={activeTab} isManager={role === "manager"} />
  );
};

export default memo(Mails);
