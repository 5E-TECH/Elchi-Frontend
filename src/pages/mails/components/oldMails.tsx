import { memo, useMemo, useState } from "react";
import {
  Calendar,
  ChevronRight,
  CheckCircle2,
  MapPinned,
  Inbox,
  Package,
  RefreshCcw,
} from "lucide-react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMails } from "../../../entities/mails";
import type { RootState } from "../../../app/config/store";
import FilterSelect from "../../../shared/ui/FilterSelect";

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

const formatPrice = (price: number): string =>
  price.toLocaleString("uz-UZ") + " so'm";

const formatDate = (dateStr: string): string =>
  new Date(dateStr).toLocaleString("uz-UZ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const getStatusMeta = (status: string) => {
  if (status === "canceled_received") {
    return {
      labelKey: "statusReturned",
      badge:
        "bg-orange-500/20 text-orange-100 border border-orange-300/20",
      icon: <RefreshCcw size={12} className="text-orange-100" />,
    };
  }

  return {
    labelKey: "statusReceived",
    badge:
      "bg-emerald-500/20 text-emerald-100 border border-emerald-300/20",
    icon: <CheckCircle2 size={12} className="text-emerald-100" />,
  };
};

const OldMailCard = memo(({ item }: { item: MailItem }) => {
  const { t } = useTranslation("mails");
  const navigate = useNavigate();
  const status = getStatusMeta(item.status);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/mails/${item.id}`, { state: { fromTab: "old", view: "old" } })}
      onKeyDown={(e) =>
        e.key === "Enter" &&
        navigate(`/mails/${item.id}`, { state: { fromTab: "old", view: "old" } })
      }
      className="group relative overflow-hidden rounded-[22px] border border-slate-500/20 cursor-pointer"
      style={{
        background:
          "linear-gradient(180deg, rgba(111,126,156,0.95) 0%, rgba(78,92,118,0.98) 100%)",
        boxShadow: "0 18px 40px rgba(66, 77, 103, 0.22)",
      }}
    >
      <div className="absolute inset-0 bg-linear-to-br from-white/8 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/10 border border-white/10">
            <Inbox size={22} className="text-white" />
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold ${status.badge}`}
            >
              {status.icon}
              {t(status.labelKey)}
            </span>
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/6 border border-white/10 group-hover:bg-white/12 transition-colors">
              <ChevronRight size={16} className="text-white/80" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-white/70 text-sm">
          <Calendar size={14} />
          <span>{formatDate(item.updatedAt || item.createdAt)}</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-white/65 text-sm">{t("ordersLabel")}:</span>
            <span className="text-white font-bold text-[28px] leading-none">
              {item.order_quantity}
              <span className="ml-1 text-base font-semibold text-white/80">ta</span>
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-white/65 text-sm">{t("amountLabel")}:</span>
            <span className="text-white font-bold text-xl text-right">
              {formatPrice(item.post_total_price)}
            </span>
          </div>
        </div>

        <div className="pt-1 flex items-center gap-2 text-xs text-white/60">
          <Package size={13} />
          <span>{item.region?.name ?? t("regionHashFallback", { id: item.region_id })}</span>
        </div>
      </div>
    </div>
  );
});
OldMailCard.displayName = "OldMailCard";

const OldMailCardSkeleton = memo(() => (
  <div className="h-44 rounded-[22px] animate-pulse bg-slate-400/20 dark:bg-white/6" />
));
OldMailCardSkeleton.displayName = "OldMailCardSkeleton";

const OldMails = () => {
  const { t } = useTranslation("mails");
  const { role } = useSelector((state: RootState) => state.role);
  const isCourier = role === "courier";
  const { getOldMails } = useMails();
  const { data, isLoading, isError } = getOldMails(isCourier);
  const [selectedRegionId, setSelectedRegionId] = useState("");

  const mails: MailItem[] = useMemo(() => data?.data?.data ?? [], [data]);
  const regionOptions = useMemo(
    () =>
      Array.from(
        new Map(
          mails
            .filter((mail) => mail.region?.id && mail.region?.name)
            .map((mail) => [
              mail.region.id,
              { value: mail.region.id, label: mail.region.name },
            ]),
        ).values(),
      ).sort((left, right) => left.label.localeCompare(right.label, "uz")),
    [mails],
  );
  const filteredMails = useMemo(
    () =>
      selectedRegionId
        ? mails.filter((mail) => mail.region?.id === selectedRegionId)
        : mails,
    [mails, selectedRegionId],
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <OldMailCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-14 h-14 rounded-2xl bg-main/10 flex items-center justify-center">
          <Inbox size={28} className="text-main" />
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {t("oldLoadError")}
        </p>
      </div>
    );
  }

  if (mails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-14 h-14 rounded-2xl bg-main/10 flex items-center justify-center">
          <Inbox size={28} className="text-main" />
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {t("emptyOld")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 sm:flex-row sm:items-end sm:justify-between dark:bg-white/3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white dark:text-white">
            {t("oldRegionFilterTitle")}
          </p>
          <p className="text-xs text-white/60 dark:text-white/55">
            {t("oldRegionFilterHint")}
          </p>
        </div>

        <div className="w-full sm:w-72">
          <FilterSelect
            label={t("oldRegionFilterLabel")}
            name="old-mails-region-filter"
            value={selectedRegionId}
            onChange={setSelectedRegionId}
            options={regionOptions}
            placeholder={t("oldRegionFilterPlaceholder")}
            icon={MapPinned}
            hideLabel
          />
        </div>
      </div>

      {filteredMails.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-main/10 flex items-center justify-center">
            <Inbox size={28} className="text-main" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {t("oldRegionFilterEmpty")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filteredMails.map((mail) => (
            <OldMailCard key={mail.id} item={mail} />
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(OldMails);
