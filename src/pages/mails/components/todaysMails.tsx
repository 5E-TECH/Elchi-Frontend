import { memo, useMemo, useState } from "react";
import { MapPin, Package, ChevronRight, TrendingUp, MapPinned } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMails } from "../../../entities/mails";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import MailSummaryStats from "./MailSummaryStats";
import SearchableSelect from "../../../shared/ui/SearchableSelect";
import { buildRegionFilterOptions } from "./lib/regionFilterOptions";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Region {
  id: string;
  name: string;
  sato_code?: string;
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
  price.toLocaleString("uz-UZ") + " so'm";

// ─── Yagona Karta Komponenti ──────────────────────────────────────────────────
const MailCard = memo(({ item }: { item: MailItem }) => {
  const { t } = useTranslation("mails");
  const navigate = useNavigate();
  // console.log(item);

  // API dan to'g'ridan-to'g'ri region.name olamiz
  const regionName = item.region?.name ?? t("regionFallback", { id: item.region_id });
  const { role } = useSelector((state: RootState) => state.role);
  const openDetail = () => navigate(`/mails/${item.id}`, { state: { fromTab: "today" } });
  // console.log(role, region);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={(e) =>
        e.key === "Enter" && openDetail()
      }
      className="mail-card group relative overflow-hidden rounded-2xl cursor-pointer"
    >
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
              {t("statusNew")}
            </span>
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/15 border border-white/25 group-hover:bg-white/25 transition-colors">
              <ChevronRight size={16} className="text-white" />
            </div>
          </div>
        </div>

        {/* Viloyat nomi */}
        <div>
          <h3 className="text-white font-bold text-lg leading-tight">
            {role === "courier"
              ? new Date(item?.createdAt).toLocaleString("uz-UZ", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : regionName}{" "}
          </h3>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-white/20" />

        {/* Buyurtmalar va summa */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-white/70 text-sm flex items-center gap-1.5">
              <Package size={13} className="text-white/50" />
              {t("ordersLabel")}:
            </span>
            <span className="text-white font-bold text-sm">
              {item.order_quantity}{" "}
              <span className="font-normal opacity-70">ta</span>
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-white/70 text-sm">{t("amountLabel")}:</span>
            <span className="text-white font-bold text-sm">
              {formatPrice(item.post_total_price)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});
MailCard.displayName = "MailCard";

// ─── Skeleton Karta ───────────────────────────────────────────────────────────
const MailCardSkeleton = memo(() => (
  <div className="rounded-2xl overflow-hidden animate-pulse">
    <div className="h-45 bg-emerald-500/20 dark:bg-emerald-800/30 rounded-2xl" />
  </div>
));
MailCardSkeleton.displayName = "MailCardSkeleton";

// ─── Asosiy Komponent ─────────────────────────────────────────────────────────
const TodaysMails = () => {
  const { t } = useTranslation("mails");
  const { role } = useSelector((state: RootState) => state.role);
  const isCourier = role === "courier";
  const [selectedRegionId, setSelectedRegionId] = useState("");

  const { getNewMails, getNewMailsCourier } = useMails();

  const courierQuery = getNewMailsCourier({ enabled: isCourier });
  const defaultQuery = getNewMails({ enabled: !isCourier });
  const response = isCourier ? courierQuery.data : defaultQuery.data;
  const isLoading = isCourier ? courierQuery.isLoading : defaultQuery.isLoading;
  const isError = isCourier ? courierQuery.isError : defaultQuery.isError;

  const mails: MailItem[] = response?.data?.data ?? response?.data ?? [];
  const regionOptions = useMemo(
    () => buildRegionFilterOptions(mails, t("oldRegionFilterPlaceholder")),
    [mails, t],
  );
  const filteredMails = useMemo(
    () =>
      selectedRegionId
        ? mails.filter((mail) => mail.region?.id === selectedRegionId)
        : mails,
    [mails, selectedRegionId],
  );

  // Umumiy hisob-kitoblar
  const stats = useMemo(() => {
    const totalOrders = filteredMails.reduce((sum, m) => sum + m.order_quantity, 0);
    const totalPrice = filteredMails.reduce((sum, m) => sum + m.post_total_price, 0);
    const totalRegions = filteredMails.length;
    return { totalOrders, totalPrice, totalRegions };
  }, [filteredMails]);

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
          {t("loadError")}
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
          {t("emptyToday")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <MailSummaryStats
          totalRegions={stats.totalRegions}
          totalOrders={stats.totalOrders}
          totalPrice={formatPrice(stats.totalPrice)}
          isCourier={role === "courier"}
          accent="success"
        />

        <div className="w-full sm:w-72 lg:w-72">
          <SearchableSelect
            label={t("oldRegionFilterLabel")}
            name="today-mails-region-filter"
            value={selectedRegionId}
            onChange={setSelectedRegionId}
            options={regionOptions}
            placeholder={t("oldRegionFilterPlaceholder")}
            icon={MapPinned}
            hideLabel
            size="sm"
          />
        </div>
      </div>

      {filteredMails.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-main/10 flex items-center justify-center">
            <Package size={28} className="text-main" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {t("oldRegionFilterEmpty")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredMails.map((mail) => (
            <MailCard key={mail.id} item={mail} />
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(TodaysMails);
