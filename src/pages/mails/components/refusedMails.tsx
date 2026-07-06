import { memo, useMemo } from "react";
import { MapPin, Package, AlertTriangle, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMails } from "../../../entities/mails";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import MailSummaryStats from "./MailSummaryStats";
import MailGridCard, { MAIL_CARD_GRID_CLASS, MAIL_CARD_SKELETON_CLASS } from "./MailGridCard";

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

const formatPrice = (price: number, currencyLabel: string): string =>
  `${price.toLocaleString("uz-UZ")} ${currencyLabel}`;

// ─── Karta ────────────────────────────────────────────────────────────────────
const RefusedMailCard = memo(({ item, currencyLabel }: { item: MailItem; currencyLabel: string }) => {
  const { t } = useTranslation("mails");
  const navigate = useNavigate();
  const regionName = item.region?.name ?? t("regionFallback", { id: item.region_id });
  const courierName = item.courier?.name;
  const openDetail = () =>
    navigate(`/mails/${item.id}`, {
      state: {
        fromTab: "refused",
        type: "refused",
        fallbackRegionId: item.region?.id ?? item.region_id,
        fallbackRegionName: regionName,
        expectedOrderCount: item.order_quantity,
      },
    });
  const title = isCourierLike
    ? new Date(item.createdAt).toLocaleString("uz-UZ", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : regionName;
    navigate(`/mails/${item.id}`, { state: { fromTab: "refused", type: "refused" } });

  return (
    <MailGridCard
      title={regionName}
      subtitle={courierName ? (
        <span className="inline-flex items-center gap-1.5">
          <User size={13} />
          {courierName}
        </span>
      ) : null}
      statusLabel={t("statusRejected")}
      statusIcon={<AlertTriangle size={11} />}
      leadingIcon={<MapPin size={20} />}
      orders={item.order_quantity}
      amount={formatPrice(item.post_total_price, currencyLabel)}
      onOpen={openDetail}
      variant="refused"
    />
  );
});
RefusedMailCard.displayName = "RefusedMailCard";

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const RefusedMailCardSkeleton = memo(() => (
  <div className="rounded-2xl overflow-hidden animate-pulse">
    <div className={`${MAIL_CARD_SKELETON_CLASS} bg-red-500/20 dark:bg-red-800/30`} />
  </div>
));
RefusedMailCardSkeleton.displayName = "RefusedMailCardSkeleton";

// ─── Asosiy komponent ─────────────────────────────────────────────────────────
const RefusedMails = () => {
  const { t } = useTranslation("mails");
  const currencyLabel = t("currencyLabel");
  const { role } = useSelector((state: RootState) => state.role);
  const isCourierLike = role === "courier";

  const { useGetRefusedMails, useGetRefusedMailsCourier } = useMails();

  const courierQuery = useGetRefusedMailsCourier({ enabled: isCourierLike });
  const defaultQuery = useGetRefusedMails({ enabled: !isCourierLike });
  const response = isCourierLike ? courierQuery.data : defaultQuery.data;
  const isLoading = isCourierLike ? courierQuery.isLoading : defaultQuery.isLoading;
  const isError = isCourierLike ? courierQuery.isError : defaultQuery.isError;

  const mails: MailItem[] = response?.data?.data ?? response?.data ?? [];

  const stats = useMemo(() => ({
    totalRegions: mails.length,
    totalOrders: mails.reduce((sum, m) => sum + m.order_quantity, 0),
    totalPrice: mails.reduce((sum, m) => sum + m.post_total_price, 0),
  }), [mails]);

  if (isLoading) {
    return (
      <div className={MAIL_CARD_GRID_CLASS}>
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
        totalPrice={formatPrice(stats.totalPrice, currencyLabel)}
        isCourier={isCourierLike}
        accent="error"
      />

      {/* Grid */}
      <div className={MAIL_CARD_GRID_CLASS}>
        {mails.map((mail) => (
          <RefusedMailCard key={mail.id} item={mail} currencyLabel={currencyLabel} />
        ))}
      </div>
    </div>
  );
};

export default memo(RefusedMails);
