import { memo, type ReactNode } from "react";
import { Mail, Package, AlertTriangle, Clock, RotateCcw } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { Mail, Package, AlertTriangle, Clock, RotateCcw, ChevronDown } from "lucide-react";
import { useSearchParams } from "react-router-dom";
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
  const location = useLocation();
  const navigate = useNavigate();
  const tabParam = new URLSearchParams(location.search).get("tab");

  if (tabParam) {
    return <Navigate replace to={getMailTabPath(tabParam)} />;
  }

  if (location.pathname === "/mails") {
    return <Navigate replace to={getMailTabPath("today")} />;
  }

  const activeTab = normalizeMailTab(location.pathname.split("/").filter(Boolean).at(-1));

  const handleTabChange = (tab: MailTab) => {
    navigate(getMailTabPath(tab));
  const [searchParams, setSearchParams] = useSearchParams();
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 640 : false,
  );
  const [isMobileTabOpen, setIsMobileTabOpen] = useState(false);
  const mobileTabsRef = useRef<HTMLDivElement | null>(null);
  const tabParam = searchParams.get("tab");
  const activeTab: Tab =
    tabParam === "today" || tabParam === "return" || tabParam === "refused" || tabParam === "old"
      ? tabParam
      : "today";

  const handleTabChange = (tab: Tab) => {
    setSearchParams({ tab });
    if (isMobile) {
      setIsMobileTabOpen(false);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 640;
      setIsMobile(mobile);
      if (!mobile) setIsMobileTabOpen(false);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile || !isMobileTabOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!mobileTabsRef.current) return;
      if (!mobileTabsRef.current.contains(event.target as Node)) {
        setIsMobileTabOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobile, isMobileTabOpen]);

  const activeTabItem = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];

  return (
    <div className="rounded-2xl bg-sidebar p-3 dark:bg-maindark sm:p-4 lg:p-6">
      <div className="rounded-2xl border border-gray-200 bg-primary p-3 shadow-sm dark:border-primarydark dark:bg-maindark sm:p-4">
        <HeaderName
          name={t("title")}
          description={t("pageDescription")}
          icon={<Mail />}
        />
      </div>

      {/* Mobile tabs */}
      <div ref={mobileTabsRef} className="mb-6 mt-5 sm:hidden">
        <button
          type="button"
          onClick={() => setIsMobileTabOpen((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-primary px-4 py-3.5 text-left shadow-sm transition-colors hover:border-main/30 dark:border-white/10 dark:bg-primarydark"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                activeTabItem.inactiveIconClassName
              }`}
            >
              {activeTabItem.icon}
            </span>
            <span className="truncate text-sm font-semibold text-maindark dark:text-primary">
              {t(activeTabItem.labelKey)}
            </span>
          </span>
          <ChevronDown
            size={18}
            className={`shrink-0 text-gray-500 transition-transform dark:text-gray-400 ${isMobileTabOpen ? "rotate-180" : ""}`}
          />
        </button>

        <div
          className={`grid transition-all duration-300 ease-out ${isMobileTabOpen ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        >
          <div className="overflow-hidden">
            <div className="space-y-2 rounded-2xl border border-gray-200 bg-primary p-2 shadow-sm dark:border-white/10 dark:bg-primarydark">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => handleTabChange(tab.key)}
                    style={isActive ? tab.activeWrapperStyle : undefined}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 ${
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
                    <span className="font-semibold text-sm leading-snug">
                      {t(tab.labelKey)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop tabs */}
      <div className="mt-5 mb-6 hidden grid-cols-1 gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-4">
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
