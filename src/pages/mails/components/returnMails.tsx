import { memo } from "react";
import { RotateCcw, Package, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMails } from "../../../entities/mails";
import Pagination from "../../../shared/components/pagination";
import { usePagination } from "../../../shared/lib/usePagination";

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
  const { getReturnMails } = useMails();
  const { page, limit, setPage, setLimit } = usePagination({
    key: "mails",
    defaultLimit: 8,
  });
  const { data: response, isLoading, isError } = getReturnMails({ page, limit });

  const mails: MailItem[] = response?.data?.data ?? [];
  const pagination = response?.data;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: limit }).map((_, index) => (
          <div
            key={index}
            className="h-43 animate-pulse rounded-2xl bg-[color:var(--color-warning-soft)]"
          />
        ))}
      </div>
    );
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
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {mails.map((mail) => (
          <ReturnCard key={mail.id} item={mail} />
        ))}
      </div>

      {pagination ? (
        <Pagination
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          currentPage={pagination.page}
          onPageChange={setPage}
          onItemsPerPageChange={setLimit}
          pageSizeOptions={[8, 16, 32, 64]}
        />
      ) : null}
    </div>
  );
};

export default memo(ReturnMails);
