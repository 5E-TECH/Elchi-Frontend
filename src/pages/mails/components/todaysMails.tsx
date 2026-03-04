import { memo, useMemo } from 'react';
import { MapPin, Package, ChevronRight, TrendingUp } from 'lucide-react';
import { useMails } from '../../../entities/mails';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Region {
  id: string;
  name: string;
  sato_code: string;
}

interface MailItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  courier_id: string;
  post_total_price: number;
  order_quantity: number;
  qr_code_token: string;
  region_id: string;
  region: Region;
  status: string;
}

// ─── Pul formati ─────────────────────────────────────────────────────────────
const formatPrice = (price: number): string =>
  price.toLocaleString('uz-UZ') + " so'm";

// ─── Yagona Karta Komponenti ──────────────────────────────────────────────────
const MailCard = memo(({ item }: { item: MailItem }) => {
  // API dan to'g'ridan-to'g'ri region.name olamiz
  const regionName = item.region?.name ?? `Viloyat ${item.region_id}`;

  return (
    <div className="mail-card group relative overflow-hidden rounded-2xl cursor-pointer">
      {/* Gradient fon */}
      <div className="mail-card-bg" />

      {/* Shimmer effekti */}
      <div className="mail-card-shimmer" />

      {/* Karta ichidagi kontent */}
      <div className="relative z-10 p-5 flex flex-col gap-3">

        {/* Yuqori qator: icon + badge + arrow */}
        <div className="flex items-start justify-between">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30">
            <MapPin size={20} className="text-white" />
          </div>

          <div className="flex items-center gap-2">
            <span className="mail-status-badge">
              <TrendingUp size={11} />
              Yangi
            </span>
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/15 border border-white/25 group-hover:bg-white/25 transition-colors">
              <ChevronRight size={16} className="text-white" />
            </div>
          </div>
        </div>

        {/* Viloyat nomi */}
        <div>
          <h3 className="text-white font-bold text-lg leading-tight">
            {regionName}
          </h3>
          {item.region?.sato_code && (
            <p className="text-white/50 text-xs mt-0.5">{item.region.sato_code}</p>
          )}
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-white/20" />

        {/* Buyurtmalar va summa */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-white/70 text-sm flex items-center gap-1.5">
              <Package size={13} className="text-white/50" />
              Buyurtmalar:
            </span>
            <span className="text-white font-bold text-sm">
              {item.order_quantity} <span className="font-normal opacity-70">ta</span>
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-white/70 text-sm">Summa:</span>
            <span className="text-white font-bold text-sm">
              {formatPrice(item.post_total_price)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});
MailCard.displayName = 'MailCard';

// ─── Skeleton Karta ───────────────────────────────────────────────────────────
const MailCardSkeleton = memo(() => (
  <div className="rounded-2xl overflow-hidden animate-pulse">
    <div className="h-[180px] bg-emerald-500/20 dark:bg-emerald-800/30 rounded-2xl" />
  </div>
));
MailCardSkeleton.displayName = 'MailCardSkeleton';

// ─── Asosiy Komponent ─────────────────────────────────────────────────────────
const TodaysMails = () => {
  const { getNewMails } = useMails();
  const { data: response, isLoading, isError } = getNewMails();

  const mails: MailItem[] = response?.data ?? [];

  // Umumiy hisob-kitoblar
  const stats = useMemo(() => {
    const totalOrders = mails.reduce((sum, m) => sum + m.order_quantity, 0);
    const totalPrice = mails.reduce((sum, m) => sum + m.post_total_price, 0);
    const totalRegions = mails.length;
    return { totalOrders, totalPrice, totalRegions };
  }, [mails]);

  // Loading holati
  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <MailCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Xato holati
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <Package size={28} className="text-red-400" />
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Ma'lumotlarni yuklab bo'lmadi
        </p>
      </div>
    );
  }

  // Bo'sh holat
  if (mails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
          <Package size={28} className="text-emerald-400" />
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Bugun yangi pochta yo'q
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Umumiy statistika */}
      <div className="flex items-center gap-6 px-1">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-gray-800 dark:text-white">
            {stats.totalRegions}
          </span>
          <span className="text-gray-500 dark:text-gray-400 text-sm">viloyat</span>
        </div>
        <div className="w-px h-5 bg-gray-200 dark:bg-white/10" />
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-gray-800 dark:text-white">
            {stats.totalOrders}
          </span>
          <span className="text-gray-500 dark:text-gray-400 text-sm">buyurtma</span>
        </div>
        <div className="w-px h-5 bg-gray-200 dark:bg-white/10" />
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-emerald-500">
            {formatPrice(stats.totalPrice)}
          </span>
        </div>
      </div>

      {/* 4-ustunli grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {mails.map((mail) => (
          <MailCard key={mail.id} item={mail} />
        ))}
      </div>

    </div>
  );
};

export default memo(TodaysMails);