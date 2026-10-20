// dizayn-v2: superadmin-neworders-create-manual-step2-existing-customer, admin-neworders-create-manual-step2-existing-customer, manager-new-orders-create-manual-step2-existing-customer, registrator-new-orders-create-step2-existing-customer, market-new-orders-create-manual-existing-customer
import { CircleX, ExternalLink, UserCheck } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { formatDateTimeLocalized } from "../../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { Badge, Button, buttonClasses } from "../../../../shared/ui/primitives";
import type { OrderCreateFormValues } from "../model/orderCreateForm";
import { CreateAlert } from "./CreateAlert";

type ExistingCustomerNoticeProps = {
  /** Market roli: matnda «sizda» (market nomi o'rniga). */
  isMarketRole: boolean;
  /** Buyurtmalar qaysi marketda — havola `/new-orders/:marketId/edit/:orderId` va matn uchun. */
  marketId: string | number | null | undefined;
  marketName?: string | null;
};

/**
 * «MAVJUD MIJOZ» BLOKI VA TAKRORIY BUYURTMA OGOHLANTIRISHI (maket `*-create-manual-step2-existing-customer`,
 * `market-…-existing-customer`; CS-A). Mijoz ma'lumotlari gridida, uch maydon ostida to'liq qatorda:
 *  - `sunken` blok: «Mavjud mijoz» (info badge), «… mijoz kartasidan to'ldirildi · <market>'da N ta buyurtma,
 *    oxirgisi …», «Bekor qilish» — tanlashdan oldingi qiymatlar qaytadi, bog'lanish uziladi;
 *  - mijozda yangi holatdagi buyurtma bo'lsa — `warning` ogohlantirish va «№id ni yangi oynada ochish».
 *
 * «O'zgartirsangiz … «Mijoz kartasi ham yangilansinmi?»» qatori chizilmaydi — backend bayrog'i kerak (CS-D).
 */
export const ExistingCustomerNotice = ({ isMarketRole, marketId, marketName }: ExistingCustomerNoticeProps) => {
  const { t, i18n } = useTranslation("orders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { control, setValue } = useFormContext<OrderCreateFormValues>();
  const existing = useWatch({ control, name: "existingCustomer" });
  if (!existing) return null;

  const market = marketName ?? "—";
  const number = (value: number) => formatNumberLocalized(value, { language });
  const ordersPart =
    existing.orders_count != null
      ? t(isMarketRole ? "createCustomer.existingOrdersOwn" : "createCustomer.existingOrdersMarket", {
          market,
          count: existing.orders_count,
          value: number(existing.orders_count),
        })
      : null;
  const lastPart = existing.last_order_at
    ? t("createCustomer.existingLast", { date: formatDateTimeLocalized(existing.last_order_at, { language }) })
    : null;
  const summary = [t("createCustomer.existingFilled"), [ordersPart, lastPart].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" · ");

  const cancel = () => {
    // Tanlashdan oldingi qiymatlar qaytadi; telefon o'zgarmaydi (taklif qayta ochilmaydi — faqat yozilganda).
    const { previous, filled } = existing;
    setValue("existingCustomer", null, { shouldDirty: true });
    setValue("customer", { ...previous, phone: filled.phone }, { shouldDirty: true });
  };

  const newCount = existing.new_orders_count;
  const orderIds = existing.new_order_ids;

  return (
    <>
      <div
        role="status"
        className="col-span-full flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-sunken px-4 py-3"
      >
        <Badge tone="info" icon={UserCheck}>
          {t("createCustomer.existingBadge")}
        </Badge>
        <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5 text-[13px] text-text-muted">{summary}</span>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={CircleX}
          aria-label={t("createCustomer.existingCancelLabel")}
          onClick={cancel}
          className="max-md:h-11"
        >
          {t("createCustomer.existingCancel")}
        </Button>
      </div>

      {newCount > 0 ? (
        <CreateAlert
          tone="warning"
          role="alert"
          className="col-span-full"
          title={t("createCustomer.newOrdersTitle")}
          action={
            marketId != null && orderIds.length > 0 ? (
              <span className="flex flex-wrap gap-x-4 gap-y-1">
                {orderIds.map((id) => (
                  <Link
                    key={id}
                    to={`/new-orders/${marketId}/edit/${id}`}
                    target="_blank"
                    rel="noopener"
                    aria-label={t("createCustomer.openOrderLabel", { id })}
                    className={buttonClasses({ variant: "link", size: "sm", className: "h-auto p-0 max-md:min-h-11" })}
                  >
                    {t("createCustomer.openOrder", { id })}
                    <ExternalLink size={16} aria-hidden="true" />
                  </Link>
                ))}
              </span>
            ) : undefined
          }
        >
          {t(isMarketRole ? "createCustomer.newOrdersBodyOwn" : "createCustomer.newOrdersBodyMarket", {
            name: existing.name,
            market,
            count: newCount,
            value: number(newCount),
          })}
        </CreateAlert>
      ) : null}
    </>
  );
};

export default ExistingCustomerNotice;
