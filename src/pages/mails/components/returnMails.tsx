import { memo } from "react";
import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMails } from "../../../entities/mails";
import Pagination from "../../../shared/components/pagination";
import { usePagination } from "../../../shared/lib/usePagination";
import MailGridCard, { MAIL_CARD_GRID_CLASS, MAIL_CARD_SKELETON_CLASS } from "./MailGridCard";

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
    <MailGridCard
      title={item.region?.name ?? t("regionFallback", { id: item.region_id })}
      statusLabel={t("statusReturned")}
      statusIcon={<RotateCcw size={11} />}
      leadingIcon={<RotateCcw size={20} />}
      orders={item.order_quantity}
      amount={formatPrice(item.post_total_price)}
      onOpen={openDetail}
      variant="return"
    />
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
      <div className={MAIL_CARD_GRID_CLASS}>
        {Array.from({ length: limit }).map((_, index) => (
          <div
            key={index}
            className={`${MAIL_CARD_SKELETON_CLASS} bg-[color:var(--color-warning-soft)]`}
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
      <div className={MAIL_CARD_GRID_CLASS}>
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
