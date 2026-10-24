// dizayn-v2: superadmin-ops-finance-operators, superadmin-ops-integrations, superadmin-ops-investors, superadmin-ops-logistics, superadmin-ops-branches, superadmin-ops-identity, superadmin-ops-system, superadmin-ops-auth-diagnostics
import { Suspense, lazy, useMemo, useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Card, getPanelId, getTabId, PageHeader, Select, SkeletonLines, Tabs } from "../../shared/ui/primitives";
import { useIsPhone } from "../../shared/ui/primitives/date/useIsPhone";
import { EXPENSE_CATEGORIES_TAB, OPS_TABS } from "./tabs";
import { OpsTabBoundary } from "./ui/OpsToolPage";

/**
 * OPS VOSITALARI — ichki xizmat ekranlari uchun yagona uy (maketlar `superadmin-ops-*`).
 *
 * NEGA KERAK BO'LDI. Yettita `*-ops` sahifasi kodda bor edi, marshruti ham bor edi, lekin UI'da HECH
 * QAYERDAN havola yo'q edi — ularni faqat URL'ni qo'lda yozib ochish mumkin edi. Alohida-alohida menyu
 * bandlari menyuni cho'zib yuborardi, shu bois ular BITTA sahifada tab bo'lib yig'ildi — bu ekranlar
 * kamdan-kam ochiladi.
 *
 * Eski `/finance-operators`, `/system-ops` va h.k. marshrutlari SAQLANADI — o'sha sahifa o'z sarlavhasi va
 * «← Ops vositalari» havolasi bilan chiziladi; hub esa o'sha komponentni `embedded` bilan (sarlavhasiz) chizadi.
 * Hub ichida tug'ilgan tab («Xarajat kategoriyalari», `pages/expense-categories`) — eski yo'lsiz, faqat shu yerda.
 *
 * Desktop/planshet — `Tabs` (title = «Eski manzil: /finance-operators»; eski yo'li yo'q tabda — yo'q), telefon —
 * `Select` («Ops bo'limi: <tab>»). Faol tab `?tab=` da; noma'lum qiymat — oxirgi tanlangan yoki birinchi tab.
 * Har tab o'z `Suspense` + xato chegarasida: bittasi yiqilsa, qolgani ishlaydi.
 */

type OpsPanel = ComponentType<{ embedded?: boolean }>;

const FinanceOperatorsPage = lazy(() => import("../finance-operators"));
const ExpenseCategoriesPage = lazy(() => import("../expense-categories"));
const IntegrationsOpsPage = lazy(() => import("../integrations-ops"));
const InvestorsOpsPage = lazy(() => import("../investors-ops"));
const LogisticsOpsPage = lazy(() => import("../logistics-ops"));
const BranchOpsPage = lazy(() => import("../branch-ops"));
const IdentityOpsPage = lazy(() => import("../identity-ops"));
const SystemOpsPage = lazy(() => import("../system-ops"));
const AuthDiagnosticsPage = lazy(() => import("../logs"));

/** Tab kalitidan komponentga xarita — ma'lumot `tabs.ts` da. */
const CONTENT: Record<string, OpsPanel> = {
  finance: FinanceOperatorsPage,
  [EXPENSE_CATEGORIES_TAB]: ExpenseCategoriesPage,
  integrations: IntegrationsOpsPage,
  investors: InvestorsOpsPage,
  logistics: LogisticsOpsPage,
  branches: BranchOpsPage,
  identity: IdentityOpsPage,
  system: SystemOpsPage,
  auth: AuthDiagnosticsPage,
};

const TABS = OPS_TABS;
const ID_PREFIX = "ops";

const OpsPage = () => {
  const { t } = useTranslation("ops");
  const isPhone = useIsPhone();
  /**
   * Faol tab URL'da saqlanadi (`?tab=`) — sahifani yangilash yoki havola yuborish tabni yo'qotmasligi kerak.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const [fallbackTab, setFallbackTab] = useState(TABS[0].key);

  const activeKey = useMemo(() => {
    const fromUrl = searchParams.get("tab");
    return TABS.some((tab) => tab.key === fromUrl) ? (fromUrl as string) : fallbackTab;
  }, [searchParams, fallbackTab]);

  const active = TABS.find((tab) => tab.key === activeKey) ?? TABS[0];
  const activeLabel = t(active.labelKey);
  const Panel = CONTENT[active.key];

  const selectTab = (key: string) => {
    setFallbackTab(key);
    const next = new URLSearchParams(searchParams);
    next.set("tab", key);
    setSearchParams(next, { replace: true });
  };

  const items = TABS.map((tab) => ({
    value: tab.key,
    label: t(tab.labelKey),
    title: tab.legacyPath ? t("hub.legacyPath", { path: tab.legacyPath }) : undefined,
  }));

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader title={t("hub.title")} description={t("hub.description")} />

      {isPhone ? (
        <Select
          options={items.map(({ value, label }) => ({ value, label }))}
          value={active.key}
          onChange={(next) => {
            if (next) selectTab(next);
          }}
          aria-label={t("hub.sectionSelect", { tab: activeLabel })}
          listLabel={t("hub.tabsLabel")}
          className="w-full"
        />
      ) : (
        <Tabs
          items={items}
          value={active.key}
          onValueChange={selectTab}
          ariaLabel={t("hub.tabsLabel")}
          idPrefix={ID_PREFIX}
          controlsPanel
        />
      )}

      <div
        role={isPhone ? "region" : "tabpanel"}
        id={getPanelId(ID_PREFIX, active.key)}
        aria-labelledby={isPhone ? undefined : getTabId(ID_PREFIX, active.key)}
        aria-label={isPhone ? activeLabel : undefined}
        className="flex min-w-0 flex-col gap-6 max-md:gap-4"
      >
        <Suspense
          fallback={
            <Card>
              <SkeletonLines lines={4} />
            </Card>
          }
        >
          <OpsTabBoundary
            key={active.key}
            title={t("hub.tabError")}
            description={t("hub.tabErrorHint")}
            retryLabel={t("common.retry")}
          >
            <Panel embedded />
          </OpsTabBoundary>
        </Suspense>
      </div>
    </div>
  );
};

export default OpsPage;
