import { memo } from 'react';
import { Mail, Package, AlertTriangle, Clock } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
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
    <div className="rounded-2xl bg-sidebar p-3 dark:bg-maindark sm:p-4 lg:p-6">
      <div className="rounded-2xl border border-gray-200 bg-primary p-3 shadow-sm dark:border-primarydark dark:bg-maindark sm:p-4">
        <div className="flex items-center gap-3 rounded-2xl bg-main/5 px-1 py-1.5 sm:bg-transparent sm:px-0 sm:py-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-main text-primary shadow-lg shadow-main/20 sm:h-13 sm:w-13">
            <Mail size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="m-0 text-lg font-bold leading-tight text-main dark:text-primary sm:text-[1.7rem]">
              Pochta
            </h2>
            <p className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-400">
              Buyurtmalar uchun pochta xabarlarini ko'rish
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-5 mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const style = isActive ? tab.active : tab.inactive;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all duration-200 cursor-pointer ${style.wrapper}`}
            >
              {/* Icon container */}
              <span className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${style.icon}`}>
                {tab.icon}
              </span>
              <span className="font-semibold text-sm leading-snug text-left">{tab.label}</span>
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
