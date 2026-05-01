import { memo } from "react";
import { RotateCcw, Package, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMails } from "../../../entities/mails";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";

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

const formatPrice = (price: number): string => `${price.toLocaleString("uz-UZ")} so'm`;

const ReturnCard = memo(({ item }: { item: MailItem }) => {
  const { t } = useTranslation("mails");
  const navigate = useNavigate();
  const openDetail = () => navigate(`/mails/${item.id}`, { state: { fromTab: "return" } });

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={(event) => event.key === "Enter" && openDetail()}
      className="group relative cursor-pointer overflow-hidden rounded-2xl"
      style={{
        background:
          "linear-gradient(135deg, var(--color-warning-start) 0%, var(--color-warning-end) 100%)",
      }}
    >
      <div className="mail-card-shimmer" />
      <div className="relative z-10 flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/30 bg-white/20 backdrop-blur-sm">
            <RotateCcw size={20} className="text-white" />
          </div>

          <div className="flex items-center gap-2">
            <span className="mail-status-badge">
              <RotateCcw size={11} />
              {t("statusReturned")}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/25 bg-white/15 transition-colors group-hover:bg-white/25">
              <ChevronRight size={16} className="text-white" />
            </div>
          </div>
        </div>

        <h3 className="text-lg font-bold leading-tight text-white">
          {item.region?.name ?? t("regionFallback", { id: item.region_id })}
        </h3>

        <div className="h-px w-full bg-white/20" />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-white/70">
              <Package size={13} className="text-white/50" />
              {t("ordersLabel")}:
            </span>
            <span className="text-sm font-bold text-white">
              {item.order_quantity} <span className="font-normal opacity-70">ta</span>
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-white/70">{t("amountLabel")}:</span>
            <span className="text-sm font-bold text-white">{formatPrice(item.post_total_price)}</span>
          </div>
        </div>
      </div>
    </div>
  );
});
ReturnCard.displayName = "ReturnCard";

const ReturnMails = () => {
  const { t } = useTranslation("mails");
  const { role } = useSelector((state: RootState) => state.role);
  const isBranchRole = role === "manager" || role === "registrator";
  const { getReturnMails } = useMails();
  const { data: response, isLoading, isError } = getReturnMails();

  if (!isBranchRole) {
    return (
      <div className="rounded-[1.75rem] border border-[color:var(--color-border-soft)] bg-primary px-6 py-14 text-center shadow-sm dark:bg-maindark">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--color-warning-soft)] text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
            <RotateCcw size={42} strokeWidth={1.75} />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-semibold text-maindark dark:text-primary">
              {t("returnEmptyTitle")}
            </h3>
            <p className="text-sm text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
              {t("returnEmptyDescription")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const mails: MailItem[] = response?.data?.data ?? [];

  if (isLoading) {
    return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" />;
  }

  if (isError || mails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--color-warning-soft)]">
          <RotateCcw size={28} className="text-[color:var(--color-warning-end)]" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("returnEmptyDescription")}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {mails.map((mail) => (
        <ReturnCard key={mail.id} item={mail} />
      ))}
    </div>
  );
};

export default memo(ReturnMails);
