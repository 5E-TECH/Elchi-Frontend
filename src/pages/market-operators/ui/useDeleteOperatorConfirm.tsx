// dizayn-v2: market-operators-delete-dialog
import { useCallback } from "react";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { hasCommission, useDeleteMarketOperator, type MarketOperator } from "../../../entities/market-operator";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { notify } from "../../../shared/lib/notify";
import { useConfirm } from "../../../shared/ui/primitives";
import { httpStatusOf } from "../model/httpStatus";
import { useCommissionText } from "../model/useCommissionText";
import { OperatorAvatar } from "./OperatorsTable";

/**
 * «OPERATORNI O'CHIRISH» (maket `market-operators-delete-dialog`, `alertdialog`, tone danger): «<ism>» operatorini
 * o'chirishni tasdiqlaysizmi?», ob'ekt kartasi (avatar, ism, «Operator · telefon», «Komissiya: …»), izoh «U tizimga
 * boshqa kira olmaydi. Yaratgan buyurtmalari va daromad tarixi saqlanadi.», «O'chirish» (qizil). `DELETE
 * market-operators/:id` (soft). So'rov ketayotganda oyna qulflanadi; xato — oyna ichida (faqat i18n matn); 404 —
 * operator allaqachon yo'q, ro'yxat yangilanadi.
 */
export const useDeleteOperatorConfirm = () => {
  const { t } = useTranslation("marketOperators");
  const confirm = useConfirm();
  const { mutateAsync } = useDeleteMarketOperator();
  const commission = useCommissionText();

  return useCallback(
    async (operator: MarketOperator) => {
      const ok = await confirm({
        tone: "danger",
        size: "sm",
        icon: Trash2,
        confirmIcon: Trash2,
        title: t("deleteDialog.title"),
        description: t("deleteDialog.description", { name: operator.name }),
        confirmLabel: t("deleteDialog.confirm"),
        loadingLabel: t("deleteDialog.loading"),
        cancelLabel: t("deleteDialog.cancel"),
        details: (
          <div className="flex items-center gap-3 rounded-[10px] bg-sunken px-3 py-2.5">
            <OperatorAvatar name={operator.name} size={40} onSunken />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-semibold text-text [overflow-wrap:anywhere]">{operator.name}</span>
              <span className="text-[13px] text-text-muted">
                {t("deleteDialog.role")} · <span className="whitespace-nowrap">{formatPhone(operator.phone_number)}</span>
              </span>
              <span className="text-[13px] text-text-muted">
                {hasCommission(operator)
                  ? t("deleteDialog.commission", {
                      value: commission.value(operator.commission_type, operator.commission_value),
                    })
                  : t("deleteDialog.commissionUnset")}
              </span>
            </span>
          </div>
        ),
        note: t("deleteDialog.note"),
        errorMessage: (error) =>
          httpStatusOf(error) === 404 ? t("deleteDialog.notFound") : t("deleteDialog.failed"),
        onConfirm: () => mutateAsync(operator.id),
      });
      if (ok) notify.success(t("deleteDialog.deleted"));
      return ok;
    },
    [commission, confirm, mutateAsync, t],
  );
};

export default useDeleteOperatorConfirm;
