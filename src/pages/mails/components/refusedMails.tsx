import { memo, useMemo } from "react";
import { MapPin, Package, ChevronRight, AlertTriangle, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMails } from "../../../entities/mails";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import MailSummaryStats from "./MailSummaryStats";

interface Region {
  id: string;
  name: string;
  sato_code: string;
}

interface Courier {
  id: string;
  name: string;
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
  courier?: Courier | null;
}

const formatPrice = (price: number): string =>
  price.toLocaleString("uz-UZ") + " so'm";

// ─── Karta ────────────────────────────────────────────────────────────────────
const RefusedMailCard = memo(({ item }: { item: MailItem }) => {
  const { t } = useTranslation("mails");
  const navigate = useNavigate();
  const { role } = useSelector((state: RootState) => state.role);
  const regionName = item.region?.name ?? t("regionFallback", { id: item.region_id });
  const courierName = item.courier?.name;
  const openDetail = () =>
    navigate(`/mails/${item.id}`, { state: { fromTab: "refused", type: "refused" } });

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={(e) =>
        e.key === "Enter" && openDetail()
      }
      className="group relative overflow-hidden rounded-2xl cursor-pointer"
      style={{
        background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
      }}
    >
      {/* Shimmer */}
      <div className="mail-card-shimmer" />

      <div className="relative z-10 p-5 flex flex-col gap-3">
        {/* Yuqori qator */}
        <div className="flex items-start justify-between">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30">
            <MapPin size={20} className="text-white" />
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/20 text-white border border-white/30">
              <AlertTriangle size={11} />
              {t("statusRejected")}
            </span>
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/15 border border-white/25 group-hover:bg-white/25 transition-colors">
              <ChevronRight size={16} className="text-white" />
            </div>
          </div>
        </div>

        {/* Sarlavha */}
        <div>
          <h3 className="text-white font-bold text-lg leading-tight">
            {role === "courier"
              ? new Date(item.createdAt).toLocaleString("uz-UZ", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : regionName}
          </h3>
          {courierName && (
            <div className="mt-1 flex items-center gap-1.5 text-sm text-white/80">
              <User size={13} className="text-white/60" />
              <span>{courierName}</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-white/20" />

        {/* Statistika */}
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
RefusedMailCard.displayName = "RefusedMailCard";

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const RefusedMailCardSkeleton = memo(() => (
  <div className="rounded-2xl overflow-hidden animate-pulse">
    <div className="h-45 bg-red-500/20 dark:bg-red-800/30 rounded-2xl" />
  </div>
));
RefusedMailCardSkeleton.displayName = "RefusedMailCardSkeleton";

// ─── Asosiy komponent ─────────────────────────────────────────────────────────
const RefusedMails = () => {
  const { t } = useTranslation("mails");
  const { role } = useSelector((state: RootState) => state.role);
  const isCourier = role === "courier";

  const { getRefusedMails, getRefusedMailsCourier } = useMails();

  const courierQuery = getRefusedMailsCourier({ enabled: isCourier });
  const defaultQuery = getRefusedMails({ enabled: !isCourier });
  const response = isCourier ? courierQuery.data : defaultQuery.data;
  const isLoading = isCourier ? courierQuery.isLoading : defaultQuery.isLoading;
  const isError = isCourier ? courierQuery.isError : defaultQuery.isError;

  const mails: MailItem[] = response?.data?.data ?? response?.data ?? [];

  const stats = useMemo(() => ({
    totalRegions: mails.length,
    totalOrders: mails.reduce((sum, m) => sum + m.order_quantity, 0),
    totalPrice: mails.reduce((sum, m) => sum + m.post_total_price, 0),
  }), [mails]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <RefusedMailCardSkeleton key={i} />
        ))}
      </div>
    );
  }

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

  if (mails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <AlertTriangle size={28} className="text-red-400" />
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {t("emptyRefused")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <MailSummaryStats
        totalRegions={stats.totalRegions}
        totalOrders={stats.totalOrders}
        totalPrice={formatPrice(stats.totalPrice)}
        isCourier={role === "courier"}
        accent="error"
      />

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {mails.map((mail) => (
          <RefusedMailCard key={mail.id} item={mail} />
        ))}
      </div>
    </div>
  );
};

export default memo(RefusedMails);
