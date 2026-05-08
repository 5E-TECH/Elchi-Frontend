import { memo, useEffect, useState, type ReactNode } from "react";
import { Mail, Package, AlertTriangle, Clock, RotateCcw, ChevronDown } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import TodaysMails from "./components/todaysMails";
import OldMails from "./components/oldMails";
import RefusedMails from "./components/refusedMails";
import ReturnMails from "./components/returnMails";
import HeaderName from "../../shared/components/headerName";
import type { RootState } from "../../app/config/store";
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
  const role = useSelector((state: RootState) => state.role.role);
  const canUseOldBatchMode = role === "admin" || role === "superadmin";
  const [isCompactTabs, setIsCompactTabs] = useState(
    typeof window !== "undefined" ? window.innerWidth < 1280 : false,
  );
  const [isCompactTabsOpen, setIsCompactTabsOpen] = useState(false);
  const [isOldBatchMenuOpen, setIsOldBatchMenuOpen] = useState(false);
  const tabParam = new URLSearchParams(location.search).get("tab");
  const shouldRedirectFromTabParam = Boolean(tabParam);
  const shouldRedirectFromRootPath = location.pathname === "/mails";

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

  const activeTab = normalizeMailTab(
    location.pathname.split("/").filter(Boolean).at(-1),
  );
  const activeTabData = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];
  const selectedBatchId = new URLSearchParams(location.search).get("batch_mode") ?? "";

  const batchOptions = [
    { value: "", label: t("oldTab") },
    { value: "all", label: t("oldBatchFilterPlaceholder") },
  ];

  const handleBatchChange = (value: string) => {
    const params = new URLSearchParams(location.search);
    if (value) params.set("batch_mode", value);
    else params.delete("batch_mode");
    navigate(`${location.pathname}${params.toString() ? `?${params.toString()}` : ""}`, { replace: true });
    setIsOldBatchMenuOpen(false);
  };

  useEffect(() => {
    if (canUseOldBatchMode || !selectedBatchId) return;
    const params = new URLSearchParams(location.search);
    params.delete("batch_mode");
    navigate(`${location.pathname}${params.toString() ? `?${params.toString()}` : ""}`, { replace: true });
  }, [canUseOldBatchMode, selectedBatchId, location.pathname, location.search, navigate]);

  if (shouldRedirectFromTabParam) {
    return <Navigate replace to={getMailTabPath(tabParam)} />;
  }

  if (shouldRedirectFromRootPath) {
    return <Navigate replace to={getMailTabPath("today")} />;
  }

  const handleTabChange = (tab: MailTab) => {
    navigate(getMailTabPath(tab));
    setIsOldBatchMenuOpen(false);
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
            onClick={() => {
              setIsCompactTabsOpen((prev) => !prev);
            }}
            style={activeTabData.activeWrapperStyle}
            className={`flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 transition-all duration-200 ${activeTabData.activeWrapperClassName}`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                {activeTabData.icon}
              </span>
              <span className="truncate text-left text-sm font-semibold leading-snug">
                {activeTab === "old" && selectedBatchId === "all"
                  ? t("oldBatchFilterPlaceholder")
                  : t(activeTabData.labelKey)}
              </span>
            </div>

            <ChevronDown
              size={18}
              className={`shrink-0 transition-transform duration-200 ${
                isCompactTabsOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {activeTab === "old" && canUseOldBatchMode && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setIsOldBatchMenuOpen((prev) => !prev)}
                className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-main/20 bg-primary px-4 py-3 text-left text-sm font-semibold text-main shadow-sm dark:border-white/10 dark:bg-primarydark dark:text-primary"
              >
                <span className="truncate">
                  {selectedBatchId === "all" ? t("oldBatchFilterPlaceholder") : t("oldTab")}
                </span>
                <ChevronDown
                  size={16}
                  className={`shrink-0 transition-transform duration-200 ${isOldBatchMenuOpen ? "rotate-180" : ""}`}
                />
              </button>
            </div>
          )}

          {activeTab === "old" && canUseOldBatchMode && isOldBatchMenuOpen && (
            <div className="mt-3 grid grid-cols-1 gap-3">
              {batchOptions.map((option) => {
                const isActive = selectedBatchId === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleBatchChange(option.value)}
                    className={`flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? "border-main bg-main text-primary shadow-lg shadow-main/25"
                        : "border-gray-200 bg-primary text-gray-600 shadow-sm hover:border-main/20 dark:border-white/10 dark:bg-primarydark dark:text-gray-300"
                    }`}
                  >
                    <span className="truncate">{option.label}</span>
                  </button>
                );
              })}
            </div>
          )}

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
            const isOldTabDropdown =
              tab.key === "old" && isActive && canUseOldBatchMode;

            if (isOldTabDropdown) {
              return (
                <div
                  key={tab.key}
                  style={tab.activeWrapperStyle}
                  className={`relative flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all duration-200 ${tab.activeWrapperClassName}`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    {tab.icon}
                  </span>

                  <div className="w-full min-w-0">
                    <button
                      type="button"
                      onClick={() => setIsOldBatchMenuOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-0 py-0 text-left text-sm font-semibold text-white"
                    >
                      <span className="truncate">
                        {selectedBatchId === "all" ? t("oldBatchFilterPlaceholder") : t("oldTab")}
                      </span>
                      <ChevronDown
                        size={16}
                        className={`shrink-0 transition-transform duration-200 ${isOldBatchMenuOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>

                  {isOldBatchMenuOpen && (
                    <div className="absolute top-[calc(100%+8px)] left-0 z-50 w-full overflow-hidden rounded-xl border border-white/20 bg-white p-1 shadow-xl">
                      {batchOptions.map((option) => {
                        const isActiveOption = selectedBatchId === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleBatchChange(option.value)}
                            className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${
                              isActiveOption
                                ? "bg-main text-white"
                                : "text-maindark hover:bg-main/10"
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                style={isActive ? tab.activeWrapperStyle : undefined}
                className={`relative flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all duration-200 ${
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
