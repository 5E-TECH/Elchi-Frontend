import { memo, useMemo, useState } from "react";
import { MapPin, Package, TrendingUp, MapPinned } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useMails } from "../../../entities/mails";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import MailSummaryStats from "./MailSummaryStats";
import SearchableSelect from "../../../shared/ui/SearchableSelect";
import { buildRegionFilterOptions } from "./lib/regionFilterOptions";
import MailGridCard, { MAIL_CARD_GRID_CLASS, MAIL_CARD_SKELETON_CLASS } from "./MailGridCard";
import { getCurrentBranchId } from "../../../shared/lib/currentBranch";
import type { OrderListItem } from "../../../entities/order/types/order";

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

const extractOrderItems = (payload: unknown): OrderListItem[] => {
  const response = payload as
    | OrderListItem[]
    | {
      data?: OrderListItem[] | { items?: OrderListItem[]; data?: OrderListItem[] };
      items?: OrderListItem[];
    };

  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (!Array.isArray(response?.data) && Array.isArray(response?.data?.items)) return response.data.items;
  if (!Array.isArray(response?.data) && Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.items)) return response.items;

  return [];
};

const buildFallbackMailsFromOrders = (orders: OrderListItem[]): MailItem[] => {
  const groups = new Map<string, MailItem>();

  orders.forEach((order) => {
    const postId = String(order.post_id ?? "").trim();
    if (!postId || order.status !== "on the road") return;

    const regionId = String(order.region_id ?? order.district?.region?.id ?? order.branch?.id ?? "branch");
    const existing = groups.get(postId);

    if (existing) {
      existing.order_quantity += 1;
      existing.post_total_price += Number(order.total_price ?? 0);
      if (order.createdAt && order.createdAt < existing.createdAt) {
        existing.createdAt = order.createdAt;
      }
      return;
    }

    groups.set(postId, {
      id: postId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      courier_id: "",
      post_total_price: Number(order.total_price ?? 0),
      order_quantity: 1,
      qr_code_token: "",
      region_id: regionId,
      region: {
        id: regionId,
        name: order.district?.region?.name ?? order.branch?.name ?? "Filial",
      },
      status: "sent",
    });
  });

  return Array.from(groups.values());
};

// ─── Pul formati ─────────────────────────────────────────────────────────────
const formatPrice = (price: number, currencyLabel: string): string =>
  `${price.toLocaleString("uz-UZ")} ${currencyLabel}`;

const MailCard = memo(({ item, currencyLabel }: { item: MailItem; currencyLabel: string }) => {
  const { t } = useTranslation("mails");
  const navigate = useNavigate();
  const regionName = item.region?.name ?? t("regionFallback", { id: item.region_id });
  const openDetail = () => navigate(`/mails/${item.id}`, { state: { fromTab: "today" } });

  return (
    <MailGridCard
      title={regionName}
      statusLabel={t("statusNew")}
      statusIcon={<TrendingUp size={11} />}
      leadingIcon={<MapPin size={20} />}
      orders={item.order_quantity}
      amount={formatPrice(item.post_total_price, currencyLabel)}
      onOpen={openDetail}
      variant="today"
    />
  );
});
MailCard.displayName = "MailCard";

// ─── Skeleton Karta ───────────────────────────────────────────────────────────
const MailCardSkeleton = memo(() => (
  <div className="rounded-2xl overflow-hidden animate-pulse">
    <div className={`${MAIL_CARD_SKELETON_CLASS} bg-emerald-500/20 dark:bg-emerald-800/30`} />
  </div>
));
MailCardSkeleton.displayName = "MailCardSkeleton";

// ─── Asosiy Komponent ─────────────────────────────────────────────────────────
const TodaysMails = () => {
  const { t } = useTranslation("mails");
  const currencyLabel = t("currencyLabel");
  const { role } = useSelector((state: RootState) => state.role);
  const branchId = useSelector(getCurrentBranchId);
  const isCourierLike = role === "courier";
  const [selectedRegionId, setSelectedRegionId] = useState("");

  const { useGetNewMails, useGetNewMailsCourier } = useMails();

  const courierQuery = useGetNewMailsCourier({ enabled: isCourierLike });
  const defaultQuery = useGetNewMails({ enabled: !isCourierLike });
  const response = isCourierLike ? courierQuery.data : defaultQuery.data;
  const isLoading = isCourierLike ? courierQuery.isLoading : defaultQuery.isLoading;
  const isError = isCourierLike ? courierQuery.isError : defaultQuery.isError;
  const fallbackOrdersQuery = useQuery({
    queryKey: ["mails", "today-fallback-orders", role, branchId],
    queryFn: () =>
      api
        .get(API_ENDPOINTS.ORDERS.BASE, {
          params: {
            page: 1,
            limit: 100,
            status: "on the road",
            ...(branchId ? { branch_id: branchId } : {}),
          },
        })
        .then((res) => res.data),
    enabled: role === "manager" && !isCourierLike,
    staleTime: 10_000,
  });

  const apiMails: MailItem[] = response?.data?.data ?? response?.data ?? [];
  const fallbackMails = useMemo(
    () => buildFallbackMailsFromOrders(extractOrderItems(fallbackOrdersQuery.data)),
    [fallbackOrdersQuery.data],
  );
  const mails = apiMails.length > 0 ? apiMails : fallbackMails;
  const regionOptions = useMemo(() => buildRegionFilterOptions(mails), [mails]);
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
        <div className={MAIL_CARD_GRID_CLASS}>
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
          totalPrice={formatPrice(stats.totalPrice, currencyLabel)}
          isCourier={isCourierLike}
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
        <div className={MAIL_CARD_GRID_CLASS}>
          {filteredMails.map((mail) => (
            <MailCard key={mail.id} item={mail} currencyLabel={currencyLabel} />
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(TodaysMails);
