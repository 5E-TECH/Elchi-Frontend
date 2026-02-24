import { memo } from 'react';
import {
  Globe,
  Search,
  RotateCcw,
  ChevronRight,
  Link as LinkIcon,
} from 'lucide-react';


// Integratsiya kartasi komponenti
const IntegrationCard = ({ name, market, count, synced }: any) => (
  <div className="bg-white dark:bg-background border border-gray-200 dark:border-white/10 rounded-2xl p-5 flex items-center justify-between group cursor-pointer hover:bg-gray-50 dark:hover:bg-background/80 transition-all duration-200">
    <div className="flex items-center gap-4">
      <div className="p-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500">
        <LinkIcon size={24} />
      </div>
      <div className="flex flex-col">
        <h4 className="text-gray-800 dark:text-white font-semibold text-lg">{name}</h4>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Market: {market}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className={`${synced ? 'text-emerald-500' : 'text-gray-500 dark:text-gray-400'} text-sm font-medium`}>
            {synced ? `✓ ${synced} ta sinxronlangan` : count}
          </span>
          {synced && <RotateCcw size={12} className="text-gray-400 dark:text-gray-500" />}
        </div>
      </div>
    </div>
    <ChevronRight className="text-gray-400 dark:text-gray-600 group-hover:text-main transition-colors" size={20} />
  </div>
);

const ExternalOrders = () => {
  return (
    <div className="space-y-8">

      {/* Integratsiyalar bo'limi */}
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500">
                <Globe size={24} />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Integratsiyalar</h2>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              QR kod orqali tashqi buyurtmalarni qidirish uchun integratsiyani tanlang
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
              <input
                type="text"
                placeholder="Market qidirish..."
                className="bg-white dark:bg-background border border-gray-200 dark:border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-main w-64 transition-colors"
              />
            </div>
            <button className="p-2.5 rounded-xl bg-white dark:bg-background border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-background/80 transition-colors">
              <RotateCcw size={18} className="text-gray-400 dark:text-gray-500" />
            </button>
          </div>
        </div>

        {/* Kartalar setkasi */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <IntegrationCard name="Adosh" market="Adosh.uz" count="0" />
          <IntegrationCard name="Ozar" market="ozar.uz" count="0" />
          <IntegrationCard name="XanaUz" market="XanaUz" count="0" />
          <IntegrationCard name="XaviUz" market="xavi.uz" synced="7" />
        </div>
      </div>
    </div>
  );
};

export default memo(ExternalOrders);