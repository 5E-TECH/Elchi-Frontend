import { memo } from 'react';
import { Mail, Package, AlertTriangle, Clock } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import HeaderName from '../../shared/components/headerName';
import TodaysMails from './components/todaysMails';
import OldMails from './components/oldMails';
import RefusedMails from './components/refusedMails';

type Tab = 'today' | 'refused' | 'old';

const tabs = [
  {
    key: 'today' as Tab,
    label: "Today's mails",
    icon: <Package size={18} />,
    active: {
      wrapper: 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/30 text-white',
      icon: 'bg-white/20 text-white',
    },
    inactive: {
      wrapper: 'bg-white dark:bg-primarydark border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-emerald-400/40 hover:shadow-sm',
      icon: 'bg-emerald-500/10 text-emerald-500',
    },
  },
  {
    key: 'refused' as Tab,
    label: 'Refused mails',
    icon: <AlertTriangle size={18} />,
    active: {
      wrapper: 'bg-red-500 border-red-500 shadow-lg shadow-red-500/30 text-white',
      icon: 'bg-white/20 text-white',
    },
    inactive: {
      wrapper: 'bg-white dark:bg-primarydark border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-red-400/40 hover:shadow-sm',
      icon: 'bg-red-500/10 text-red-500',
    },
  },
  {
    key: 'old' as Tab,
    label: 'Old mails',
    icon: <Clock size={18} />,
    active: {
      wrapper: 'bg-main border-main shadow-lg shadow-main/30 text-white',
      icon: 'bg-white/20 text-white',
    },
    inactive: {
      wrapper: 'bg-white dark:bg-primarydark border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-main/40 hover:shadow-sm',
      icon: 'bg-main/10 text-main',
    },
  },
];

const Mails = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: Tab =
    tabParam === 'today' || tabParam === 'refused' || tabParam === 'old'
      ? tabParam
      : 'today';

  const handleTabChange = (tab: Tab) => {
    setSearchParams({ tab });
  };

  return (
    <div className="p-6 rounded-2xl bg-sidebar dark:bg-maindark">
      <HeaderName
        name="Pochta"
        description="Buyurtmalar uchun pochta xabarlarini ko'rish"
        icon={<Mail />}
      />

      {/* Tabs */}
      <div className="flex items-center gap-3 mt-5 mb-6">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const style = isActive ? tab.active : tab.inactive;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl w-full border transition-all duration-200 cursor-pointer ${style.wrapper}`}
            >
              {/* Icon container */}
              <span className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${style.icon}`}>
                {tab.icon}
              </span>
              <span className="font-semibold text-sm">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === 'today' && <TodaysMails />}
      {activeTab === 'refused' && <RefusedMails />}
      {activeTab === 'old' && <OldMails />}
    </div>
  );
};

export default memo(Mails);
