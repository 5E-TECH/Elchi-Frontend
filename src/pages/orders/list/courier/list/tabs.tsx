import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Clock, ClipboardList, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

type Tab = {
  id: string;
  labelKey: string;
  icon: ReactNode;
  activeBackground: string;
};

type TabsProps = {
  onChange?: (tabId: string) => void;
  defaultTab?: string;
};

const tabs: Tab[] = [
  {
    id: "pending",
    labelKey: "pendingOrders",
    icon: <Clock size={16} />,
    activeBackground: "linear-gradient(135deg, #ff8c00, #ff5500)",
  },
  {
    id: "all",
    labelKey: "allOrders",
    icon: <ClipboardList size={16} />,
    activeBackground: "#576adb",
  },
  {
    id: "cancelled",
    labelKey: "cancelledOrders",
    icon: <XCircle size={16} />,
    activeBackground: "linear-gradient(135deg, #ef4444, #b91c1c)",
  },
];

const Tabs = ({ onChange, defaultTab = "pending" }: TabsProps) => {
  const { t } = useTranslation("orders");
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 640 : false,
  );
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const mobileTabsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 640;
      setIsMobile(mobile);
      if (!mobile) setIsMobileOpen(false);
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isMobile || !isMobileOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!mobileTabsRef.current) return;
      if (!mobileTabsRef.current.contains(event.target as Node)) {
        setIsMobileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobile, isMobileOpen]);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
    if (isMobile) {
      setIsMobileOpen(false);
    }
  };

  const activeTabItem = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <div className="mt-4">
      <div ref={mobileTabsRef} className="sm:hidden">
        <button
          type="button"
          onClick={() => setIsMobileOpen((prev) => !prev)}
          style={{ background: activeTabItem.activeBackground }}
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left font-semibold text-sm text-white shadow-lg"
        >
          <span className="flex min-w-0 items-center gap-2">
            {activeTabItem.icon}
            <span className="truncate">{t(activeTabItem.labelKey)}</span>
          </span>
          <ChevronDown
            size={18}
            className={`shrink-0 text-white/90 transition-transform ${isMobileOpen ? "rotate-180" : ""}`}
          />
        </button>

        <div
          className={`grid transition-all duration-300 ease-out ${isMobileOpen ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        >
          <div className="overflow-hidden">
            <div className="space-y-2 rounded-xl border border-gray-300/60 bg-transparent p-2 dark:border-gray-600/60">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabClick(tab.id)}
                    style={isActive ? { background: tab.activeBackground } : undefined}
                    className={`
                      flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-center
                      font-semibold text-sm transition-all duration-200
                      ${
                        isActive
                          ? "text-white border-none shadow-md [&_svg]:text-white"
                          : "text-gray-600 dark:text-gray-200 border border-gray-300 dark:border-gray-600 bg-transparent [&_svg]:text-gray-500 dark:[&_svg]:text-gray-300"
                      }
                    `}
                  >
                    {tab.icon}
                    {t(tab.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="hidden grid-cols-1 gap-2 sm:grid sm:grid-cols-3">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              style={
                isActive
                  ? { background: tab.activeBackground }
                  : { background: "transparent" }
              }
              className={`
                flex min-h-14 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-center
                cursor-pointer font-semibold text-sm transition-all duration-250
                ${
                  isActive
                    ? "text-white border-none shadow-lg [&_svg]:text-white"
                    : `
                      text-gray-600 dark:text-gray-200
                      border border-gray-300 dark:border-gray-600
                      hover:text-gray-800 dark:hover:text-white
                      hover:border-gray-400 dark:hover:border-gray-400
                      [&_svg]:text-gray-500 dark:[&_svg]:text-gray-300
                      hover:[&_svg]:text-gray-700 dark:hover:[&_svg]:text-white
                    `
                }
              `}
            >
              {tab.icon}
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default memo(Tabs);
