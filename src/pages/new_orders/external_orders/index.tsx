import { memo } from 'react';
import {
  Globe,
  RotateCcw,
  ChevronRight,
  Link as LinkIcon,
} from 'lucide-react';
import { Controller, useForm } from "react-hook-form";
import { GlobalSearchInput } from "../../../features/search";


// Integratsiya kartasi komponenti
const IntegrationCard = ({ name, market, count, synced }: any) => (
  <div className="bg-white dark:bg-primarydark border border-gray-200 dark:border-white/10 rounded-2xl p-5 flex items-center justify-between group cursor-pointer hover:bg-gray-50 dark:hover:bg-primarydark/80 transition-all duration-200">
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

interface ExternalOrdersSearchValues {
  search: string;
}

const ExternalOrders = () => {
  const { control } = useForm<ExternalOrdersSearchValues>({
    defaultValues: { search: "" },
  });

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
            <Controller
              control={control}
              name="search"
              render={({ field }) => (
                <GlobalSearchInput
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  placeholder="Market qidirish..."
                  className="w-64"
                  inputClassName="bg-white dark:bg-primarydark border-gray-200 dark:border-white/10 text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 py-2.5 shadow-none focus:shadow-none"
                  iconClassName="text-gray-400 dark:text-gray-500 group-focus-within:text-main"
                  clearButtonClassName="text-gray-400 dark:text-gray-500 hover:text-main"
                  onValueChange={field.onChange}
                />
              )}
            />
            <button className="p-2.5 rounded-xl bg-white dark:bg-primarydark border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-primarydark/80 transition-colors">
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
