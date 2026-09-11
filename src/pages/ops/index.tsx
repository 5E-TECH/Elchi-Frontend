import { Suspense, lazy, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { OPS_TABS } from "./tabs";
import {
  Banknote,
  Building2,
  Cable,
  Loader2,
  PiggyBank,
  Server,
  Truck,
  UsersRound,
  Wrench,
} from "lucide-react";

/**
 * OPS VOSITALARI — ichki xizmat ekranlari uchun yagona uy.
 *
 * NEGA KERAK BO'LDI. Yettita `*-ops` sahifasi kodda bor edi, marshruti ham
 * bor edi, lekin UI'da HECH QAYERDAN havola yo'q edi — ularni faqat URL'ni
 * qo'lda yozib ochish mumkin edi. Ya'ni 800 qatordan ortiq ishlaydigan kod
 * foydalanuvchi uchun mavjud emasdi.
 *
 * Alohida-alohida yettita menyu bandi qo'shish menyuni yana cho'zib yuborardi
 * (aynan B1 hal qilgan muammo), shu bois ular BITTA sahifada tab bo'lib
 * yig'ildi — bu ekranlar kamdan-kam ochiladi.
 *
 * Eski `/finance-operators`, `/system-ops` va h.k. marshrutlari SAQLANADI —
 * eski havola yoki xatcho'p buzilmasin.
 *
 * ⚠️ Bu ekranlar antd bilan yozilgan, qolgan ilova esa tailwind. Ularni
 * umumiy dizaynga o'tkazish alohida ish (reja: B6).
 */

const FinanceOperatorsPage = lazy(() => import("../finance-operators"));
const IntegrationsOpsPage = lazy(() => import("../integrations-ops"));
const InvestorsOpsPage = lazy(() => import("../investors-ops"));
const LogisticsOpsPage = lazy(() => import("../logistics-ops"));
const BranchOpsPage = lazy(() => import("../branch-ops"));
const IdentityOpsPage = lazy(() => import("../identity-ops"));
const SystemOpsPage = lazy(() => import("../system-ops"));

/** Tab kalitidan komponentga xarita — ma'lumot `tabs.ts` da. */
const CONTENT: Record<string, ReactNode> = {
  finance: <FinanceOperatorsPage />,
  integrations: <IntegrationsOpsPage />,
  investors: <InvestorsOpsPage />,
  logistics: <LogisticsOpsPage />,
  branches: <BranchOpsPage />,
  identity: <IdentityOpsPage />,
  system: <SystemOpsPage />,
};

const ICONS: Record<string, ReactNode> = {
  finance: <Banknote size={16} />,
  integrations: <Cable size={16} />,
  investors: <PiggyBank size={16} />,
  logistics: <Truck size={16} />,
  branches: <Building2 size={16} />,
  identity: <UsersRound size={16} />,
  system: <Server size={16} />,
};

const TABS = OPS_TABS;

const OpsPage = () => {
  /**
   * Faol tab URL'da saqlanadi (`?tab=`) — sahifani yangilash yoki havola
   * yuborish tabni yo'qotmasligi kerak.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const [fallbackTab, setFallbackTab] = useState(TABS[0].key);

  const activeKey = useMemo(() => {
    const fromUrl = searchParams.get("tab");
    return TABS.some((tab) => tab.key === fromUrl)
      ? (fromUrl as string)
      : fallbackTab;
  }, [searchParams, fallbackTab]);

  const active = TABS.find((tab) => tab.key === activeKey) ?? TABS[0];

  const selectTab = (key: string) => {
    setFallbackTab(key);
    const next = new URLSearchParams(searchParams);
    next.set("tab", key);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-primary p-4 shadow-sm sm:rounded-[28px] dark:bg-primarydark">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-main/10 text-main">
            <Wrench size={20} />
          </span>
          <div>
            <h1 className="m-0 text-lg font-extrabold text-maindark dark:text-white">
              Ops vositalari
            </h1>
            <p className="m-0 mt-1 text-xs text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
              Ichki xizmat ekranlari — kamdan-kam ishlatiladi, faqat superadmin
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {TABS.map((tab) => {
            const on = tab.key === active.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => selectTab(tab.key)}
                title={tab.legacyPath}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-all ${
                  on
                    ? "border-main bg-main text-white shadow-sm"
                    : "border-[color:var(--color-border-soft)] bg-white text-maindark/70 hover:border-main/40 hover:text-main dark:bg-white/[0.04] dark:text-primary/70"
                }`}
              >
                {ICONS[tab.key]}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-primary shadow-sm sm:rounded-[28px] dark:bg-primarydark">
        <Suspense
          fallback={
            <div className="flex min-h-[220px] items-center justify-center">
              <Loader2 className="animate-spin text-main" size={26} />
            </div>
          }
        >
          {CONTENT[active.key]}
        </Suspense>
      </div>
    </div>
  );
};

export default OpsPage;
