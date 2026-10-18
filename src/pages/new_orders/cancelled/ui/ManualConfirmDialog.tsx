// dizayn-v2: superadmin-neworders-cancelled-manual-dialog, admin-neworders-cancelled-manual-dialog, registrator-new-orders-cancelled-manual-dialog
import { useMemo } from "react";
import { CircleCheck, ScrollText, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../../shared/lib/cx";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { formatPhone } from "../../../../shared/lib/formatPhone";
import { Button, Dialog } from "../../../../shared/ui/primitives";
import { DetailAlert } from "../../components/detail/DetailAlert";
import { readOrderDistrict, readProductLines, type MarketOrder } from "../../components/marketOrders/marketOrdersModel";
import { CANCELLED_MANUAL_REASONS } from "../utils";

/**
 * «QR buzilganini tasdiqlash» oynasi (maket `*-cancelled-manual-dialog`; telefonda pastki varaqa).
 *
 * Buyurtma qisqacha (sunken quti: mijoz · summa, «№ · tuman · telefon», mahsulotlar), «Sabab *» — 4 ta
 * radio-karta (`.el-choice-card`), jurnal eslatmasi va «Bekor qilish» / «Qo'lda tasdiqlash».
 * ⚠️ Radio QIYMATI — backend enum kodi (`CANCELLED_MANUAL_REASONS[].value`, o'zbekcha, o'zgarmaydi);
 * foydalanuvchiga faqat tarjima yorlig'i ko'rinadi (fix3 FE-RET-05).
 */

type ManualConfirmDialogProps = {
  order: MarketOrder | null;
  reason: string;
  onReasonChange: (reason: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export const ManualConfirmDialog = ({ order, reason, onReasonChange, onCancel, onConfirm }: ManualConfirmDialogProps) => {
  const { t, i18n } = useTranslation("newOrders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const options = useMemo(
    () => CANCELLED_MANUAL_REASONS.map((item) => ({ value: item.value, label: t(item.labelKey) })),
    [t],
  );

  const district = order ? (readOrderDistrict(order) ?? order.address) : null;
  const phone = order ? formatPhone(order.customer?.phone_number) : "";
  const sub = order ? [`№${order.id}`, district, phone].filter(Boolean).join(" · ") : "";
  const products = order ? readProductLines(order) : [];

  return (
    <Dialog
      open={order !== null}
      onClose={onCancel}
      size="md"
      icon={TriangleAlert}
      iconTone="warning"
      title={t("cancelled.manual.title")}
      description={t("cancelled.manual.description")}
      onSubmit={(event) => {
        event.preventDefault();
        onConfirm();
      }}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} className="flex-[1_1_auto]">
            {t("cancelled.manual.cancel")}
          </Button>
          <Button type="submit" leftIcon={CircleCheck} className="flex-[1_1_auto]">
            {t("cancelled.manual.confirm")}
          </Button>
        </>
      }
    >
      {order ? (
        <div className="flex flex-col gap-1 rounded-xl bg-sunken px-4 py-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 text-sm font-semibold text-text">{order.customer?.name ?? "—"}</span>
            <span className="whitespace-nowrap font-semibold text-text">
              {formatMoneyLocalized(order.total_price, { language })}
            </span>
          </div>
          <span className="text-[13px] text-text-muted">{sub}</span>
          {products.length > 0 ? (
            <span className="text-[13px] text-text">
              {products.map((line, index) => (
                <span key={line.key}>
                  {index > 0 ? ", " : null}
                  {line.name}{" "}
                  <span className="text-text-muted">× {formatNumberLocalized(line.quantity, { language })}</span>
                </span>
              ))}
            </span>
          ) : null}
        </div>
      ) : null}

      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="mb-2 p-0 text-[13px] font-semibold text-text">
          {t("cancelled.manual.reasonLabel")}{" "}
          <span aria-hidden="true" className="text-danger-fg">
            *
          </span>
        </legend>
        {options.map((option) => {
          const checked = option.value === reason;
          return (
            <label
              key={option.value}
              className={cx(
                "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px] text-text",
                "transition-[background-color,border-color] duration-150 motion-reduce:transition-none",
                checked ? "border-action bg-action-soft font-semibold" : "border-border-strong bg-surface font-medium hover:border-text-subtle",
              )}
            >
              <input
                type="radio"
                name="cancelled-manual-reason"
                value={option.value}
                checked={checked}
                required
                onChange={() => onReasonChange(option.value)}
                className="size-[18px] shrink-0 cursor-pointer accent-action"
              />
              {option.label}
            </label>
          );
        })}
      </fieldset>

      <DetailAlert tone="neutral" icon={ScrollText} role="note" compact>
        {t("cancelled.manual.note")}
      </DetailAlert>
    </Dialog>
  );
};
