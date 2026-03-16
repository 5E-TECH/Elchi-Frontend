import { memo, useState } from "react";
import { Clock, ClipboardList, XCircle } from "lucide-react";

type Tab = {
  id: string;
  label: string;
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
    label: "Kutilayotgan Buyurtmalar",
    icon: <Clock size={16} />,
    activeBackground: "linear-gradient(135deg, #ff8c00, #ff5500)",
  },
  {
    id: "all",
    label: "Hamma buyurtmalar",
    icon: <ClipboardList size={16} />,
    activeBackground: "#576adb",
  },
  {
    id: "cancelled",
    label: "Bekor qilingan Buyurtmalar",
    icon: <XCircle size={16} />,
    activeBackground: "linear-gradient(135deg, #ef4444, #b91c1c)",
  },
];

const Tabs = ({ onChange, defaultTab = "pending" }: TabsProps) => {
  const [activeTab, setActiveTab] = useState(defaultTab);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  return (
    <div className="flex gap-2 p-2">
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
              flex flex-1 items-center justify-center gap-2 
              px-5 py-3 rounded-lg cursor-pointer 
              font-semibold text-sm transition-all duration-250
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
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export default memo(Tabs);