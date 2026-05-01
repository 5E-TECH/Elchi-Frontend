import { memo, useEffect, useState, type ReactNode } from "react";
import { Mail, Package, AlertTriangle, Clock, RotateCcw, ChevronDown } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import TodaysMails from "./components/todaysMails";
import OldMails from "./components/oldMails";
import RefusedMails from "./components/refusedMails";
import ReturnMails from "./components/returnMails";
import HeaderName from "../../shared/components/headerName";
import {
  getMailTabPath,
  normalizeMailTab,
  type MailTab,
} from "./lib/navigation";

interface TabItem {
  key: MailTab;
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
    activeWrapperClassName:
      "border-error bg-error text-primary shadow-lg shadow-error/25",
    inactiveIconClassName: "bg-error/10 text-error",
  },
  {
    key: "old",
    icon: <Clock size={18} />,
    labelKey: "oldTab",
    activeWrapperClassName:
      "border-main bg-main text-primary shadow-lg shadow-main/25",
    inactiveIconClassName: "bg-main/10 text-main",
  },
];

const Mails = () => {
  const { t } = useTranslation("mails");
  const location = useLocation();
  const navigate = useNavigate();
  const [isCompactTabs, setIsCompactTabs] = useState(
    typeof window !== "undefined" ? window.innerWidth < 1280 : false,
  );
  const [isCompactTabsOpen, setIsCompactTabsOpen] = useState(false);
  const tabParam = new URLSearchParams(location.search).get("tab");

  useEffect(() => {
    const handleResize = () => {
      const isCompact = window.innerWidth < 1280;
      setIsCompactTabs(isCompact);
      if (!isCompact) {
        setIsCompactTabsOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (tabParam) {
    return <Navigate replace to={getMailTabPath(tabParam)} />;
  }

  if (location.pathname === "/mails") {
    return <Navigate replace to={getMailTabPath("today")} />;
  }

  const activeTab = normalizeMailTab(
    location.pathname.split("/").filter(Boolean).at(-1),
  );
  const activeTabData = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];

  const handleTabChange = (tab: MailTab) => {
    navigate(getMailTabPath(tab));
    if (isCompactTabs) {
      setIsCompactTabsOpen(false);
    }
  };

  return (
    <div className="rounded-2xl p-3 sm:p-4 lg:p-6">
      <div className="rounded-2xl border border-gray-200 bg-primary p-3 shadow-sm dark:border-primarydark dark:bg-maindark sm:p-4">
        <HeaderName
          name={t("title")}
          description={t("pageDescription")}
          icon={<Mail />}
        />
      </div>

      {isCompactTabs ? (
        <div className="mb-6 mt-5">
          <button
            type="button"
            onClick={() => setIsCompactTabsOpen((prev) => !prev)}
            style={activeTabData.activeWrapperStyle}
            className={`flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 transition-all duration-200 ${activeTabData.activeWrapperClassName}`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                {activeTabData.icon}
              </span>
              <span className="truncate text-left text-sm font-semibold leading-snug">
                {t(activeTabData.labelKey)}
              </span>
            </div>

            <ChevronDown
              size={18}
              className={`shrink-0 transition-transform duration-200 ${isCompactTabsOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isCompactTabsOpen && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {tabs.filter((tab) => tab.key !== activeTab).map((tab) => {
                const isActive = activeTab === tab.key;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => handleTabChange(tab.key)}
                    style={isActive ? tab.activeWrapperStyle : undefined}
                    className={`flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all duration-200 ${
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
                    <span className="text-left text-sm font-semibold leading-snug">
                      {t(tab.labelKey)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="mb-6 mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                style={isActive ? tab.activeWrapperStyle : undefined}
                className={`flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all duration-200 ${
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
                <span className="text-left text-sm font-semibold leading-snug">
                  {t(tab.labelKey)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {activeTab === "today" && <TodaysMails />}
      {activeTab === "return" && <ReturnMails />}
      {activeTab === "refused" && <RefusedMails />}
      {activeTab === "old" && <OldMails />}
    </div>
  );
};

export default memo(Mails);
