// dizayn-v2: superadmin-orders-detail, admin-orders-detail, manager-orders-detail, registrator-orders-detail, market-orders-detail
import { ChevronRight, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { formatPhone } from "../../../../shared/lib/formatPhone";
import { Card } from "../../../../shared/ui/primitives";
import { getInitials } from "../../../orders/list/courier/list/orderActionModel";
import { EditButton } from "./EditButton";
import type { CustomerEditMode } from "./orderDetailAccess";
import type { OrderDetail } from "./orderDetailModel";

/** Mijoz kartasidagi qulf izohi (`registrator-orders-detail`: tugma `aria-describedby`). */
export const CUSTOMER_LOCK_ID = "cust-lock";

type CustomerCardProps = {
  order: OrderDetail;
  /** `market` — `market-orders-detail`: avatar + ism, ostida faqat «Telefon». */
  variant?: "default" | "market";
  /** Ism `/all-users/:id` havolasi — faqat «Foydalanuvchilar» sahifasi rolga ochiq bo'lsa. */
  canOpenProfile?: boolean;
  edit?: CustomerEditMode;
  /** Filialga jo'natilgan — tahrirlash o'chiq. */
  locked?: boolean;
  /** O'chiq tugmani izohlovchi sahifa ogohlantirishi (`#edit-lock`). */
  lockDescribedBy?: string;
  showLockHint?: boolean;
  onEdit?: () => void;
  className?: string;
};

export const CustomerCard = ({
  order,
  variant = "default",
  canOpenProfile = false,
  edit = "hidden",
  locked = false,
  lockDescribedBy,
  showLockHint = false,
  onEdit,
  className,
}: CustomerCardProps) => {
  const { t } = useTranslation(["orders", "newOrders"]);
  const name = order.customer.name.trim() || "—";
  const profileHref = canOpenProfile && order.customer.id ? `/all-users/${order.customer.id}` : null;
  const editLabel = t("editCustomer", { ns: "newOrders" });
  const adminOnly = t("customerEditAdminOnly", { ns: "newOrders" });

  const actions =
    edit === "button" ? (
      <EditButton
        label={editLabel}
        onClick={() => onEdit?.()}
        disabled={locked}
        reason={t("destinationLockReason", { ns: "newOrders" })}
        describedBy={lockDescribedBy}
      />
    ) : edit === "disabled" ? (
      <EditButton
        label={editLabel}
        onClick={() => undefined}
        disabled
        disabledLabel={t("orderDetail.editAdminOnly", { label: editLabel })}
        reason={locked ? t("destinationLockReason", { ns: "newOrders" }) : adminOnly}
        describedBy={showLockHint ? CUSTOMER_LOCK_ID : lockDescribedBy}
      />
    ) : undefined;

  const avatar = (
    <span
      aria-hidden="true"
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-avatar text-[13px] font-bold text-on-avatar"
    >
      {getInitials(order.customer.name)}
    </span>
  );

  const identity = profileHref ? (
    <Link to={profileHref} className="-my-0.5 flex min-w-0 items-center gap-3 rounded-lg py-0.5 text-text">
      {avatar}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold text-text">{name}</span>
        <span className="text-[13px] text-text-muted">{t("customerProfileHint", { ns: "newOrders" })}</span>
      </span>
      <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-text-subtle" />
    </Link>
  ) : (
    <div className="flex min-w-0 items-center gap-3">
      {avatar}
      <span className="min-w-0 flex-1 font-semibold text-text">{name}</span>
    </div>
  );

  const phone = (
    <dl className="m-0 grid grid-cols-[120px_1fr] gap-x-4 gap-y-2.5 text-sm">
      <dt className="text-text-muted">{t("phone", { ns: "newOrders" })}</dt>
      <dd className="m-0 min-w-0 font-semibold text-text">{formatPhone(order.customer.phone_number)}</dd>
    </dl>
  );

  return (
    <Card
      title={t("orderDetail.customer")}
      actions={actions}
      className={className}
      bodyClassName="flex flex-col gap-4 text-sm"
    >
      {identity}
      {variant === "market" ? (
        phone
      ) : (
        <>
          <hr className="m-0 h-px border-0 bg-border" />
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[.05em] text-text-muted">
              {t("contactInformation", { ns: "newOrders" })}
            </span>
            {phone}
          </div>
        </>
      )}
      {showLockHint ? (
        <p
          id={CUSTOMER_LOCK_ID}
          className="m-0 flex items-start gap-2 rounded-[10px] bg-sunken px-3 py-2.5 text-[13px] text-text-muted"
        >
          <Lock size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{adminOnly}</span>
        </p>
      ) : null}
    </Card>
  );
};
