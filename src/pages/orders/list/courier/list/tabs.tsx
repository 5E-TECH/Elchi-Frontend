import { memo, useState } from "react";
import { Clock, ClipboardList, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

type Tab = {
  id: string;
  labelKey: string;
  icon: React.ReactNode;
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

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  return (
    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
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
  );
};

export default memo(Tabs);
