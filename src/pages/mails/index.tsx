import { memo, type ReactNode } from "react";
import { Mail, Package, AlertTriangle, Clock, RotateCcw } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import TodaysMails from "./components/todaysMails";
import OldMails from "./components/oldMails";
import RefusedMails from "./components/refusedMails";
import ReturnMails from "./components/returnMails";

type Tab = "today" | "return" | "refused" | "old";

interface TabItem {
  key: Tab;
  icon: ReactNode;
  labelKey: "todayTab" | "returnTab" | "refusedTab" | "oldTab";
  activeWrapperClassName: string;
  activeWrapperStyle?: React.CSSProperties;
  inactiveIconClassName: string;
}

const tabs: TabItem[] = [
  {
    key: "today",
    icon: <Package size={18} />,
    labelKey: "todayTab",
    activeWrapperClassName:
      "border-success bg-success text-primary shadow-lg shadow-success/25",
    inactiveIconClassName: "bg-success/10 text-success",
  },
  {
    key: "return",
    icon: <RotateCcw size={18} />,
    labelKey: "returnTab",
    activeWrapperClassName: "border-transparent text-primary shadow-lg",
    activeWrapperStyle: {
      background:
        "linear-gradient(135deg, var(--color-warning-start) 0%, var(--color-warning-end) 100%)",
      boxShadow: "0 18px 34px var(--color-warning-border)",
    },
    inactiveIconClassName:
      "bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning-end)]",
  },
  {
    key: "refused",
    icon: <AlertTriangle size={18} />,
    labelKey: "refusedTab",
    activeWrapperClassName: "border-error bg-error text-primary shadow-lg shadow-error/25",
    inactiveIconClassName: "bg-error/10 text-error",
  },
  {
    key: "old",
    icon: <Clock size={18} />,
    labelKey: "oldTab",
    activeWrapperClassName: "border-main bg-main text-primary shadow-lg shadow-main/25",
    inactiveIconClassName: "bg-main/10 text-main",
  },
];

const Mails = () => {
  const { t } = useTranslation("mails");
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: Tab =
    tabParam === "today" || tabParam === "return" || tabParam === "refused" || tabParam === "old"
      ? tabParam
      : "today";

  const handleTabChange = (tab: Tab) => {
    setSearchParams({ tab });
  };

  return (
    <div className="rounded-2xl bg-sidebar p-3 dark:bg-maindark sm:p-4 lg:p-6">
      <div className="rounded-2xl border border-gray-200 bg-primary p-3 shadow-sm dark:border-primarydark dark:bg-maindark sm:p-4">
        <div className="flex items-center gap-2.5 rounded-2xl bg-main/5 px-1 py-1.5 sm:bg-transparent sm:px-0 sm:py-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-main text-primary shadow-lg shadow-main/20">
            <Mail size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="m-0 text-[16px] font-bold leading-tight text-main dark:text-primary">
              {t("title")}
            </h2>
            <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
              {t("pageDescription")}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-5 mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              style={isActive ? tab.activeWrapperStyle : undefined}
              className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all duration-200 cursor-pointer ${
                isActive
                  ? tab.activeWrapperClassName
                  : "border-gray-200 bg-primary text-gray-600 shadow-sm hover:border-main/20 dark:border-white/10 dark:bg-primarydark dark:text-gray-300"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  isActive ? "bg-primary/15 text-primary" : tab.inactiveIconClassName
                }`}
              >
                {tab.icon}
              </span>
              <span className="font-semibold text-sm leading-snug text-left">
                {t(tab.labelKey)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === "today" && <TodaysMails />}
      {activeTab === "return" && <ReturnMails />}
      {activeTab === "refused" && <RefusedMails />}
      {activeTab === "old" && <OldMails />}
    </div>
  );
};

export default memo(Mails);
