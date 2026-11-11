import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import type { Branch } from "../../../entities/branch";
import { useUpdateBranchCashboxDebt } from "../../../features/branch-edit";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { cx } from "../../../shared/lib/cx";
import { notify } from "../../../shared/lib/notify";
import { Card, Pressable } from "../../../shared/ui/primitives";

/**
 * «Kassa sozlamalari» — filial tafsilotida «Kassa qarzga ishlaydi» kaliti (`.el-switch`, market tafsilotidagi
 * kalit bilan bir xil ko'rinish). Faqat superadmin/admin va HQ bo'lmagan filialda (HQ o'ziga pul topshirmaydi).
 * Yoqiq bo'lsa HQ filialdan qarzidan ortiq qabul qila oladi — filial kassasi minusga tushadi, ortig'i «HQ qarzi».
 */
const BranchCashboxDebtCard = ({ branch }: { branch: Branch }) => {
  const { t } = useTranslation("branches");
  const descriptionId = useId();
  const role = useSelector((state: RootState) => state.role.role);
  const updateDebt = useUpdateBranchCashboxDebt();

  if (branch.type === "HQ" || (role !== "superadmin" && role !== "admin")) return null;

  const checked = branch.cashbox_debt_enabled === true;
  const busy = updateDebt.isPending;
  const title = t("v2.detail.cashboxDebt");

  const toggle = async () => {
    const next = !checked;
    try {
      await updateDebt.mutateAsync({ id: branch.id, cashbox_debt_enabled: next });
      notify.success(next ? t("v2.detail.cashboxDebtOn") : t("v2.detail.cashboxDebtOff"));
    } catch (error) {
      notify.error(t("v2.detail.cashboxDebtError"), { description: getBackendErrorMessage(error) });
    }
  };

  return (
    <Card as="section" title={t("v2.detail.cashboxTitle")} padding="none">
      <div className="flex min-h-16 items-center gap-4 px-5 py-3 max-md:px-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="m-0 text-sm font-semibold text-text">{title}</h3>
          <p id={descriptionId} className="m-0 text-[13px] text-text-muted">
            {t("v2.detail.cashboxDebtHint")}
          </p>
        </div>
        <Pressable
          role="switch"
          aria-checked={checked}
          aria-label={title}
          aria-describedby={descriptionId}
          aria-busy={busy || undefined}
          disabled={busy}
          onClick={() => void toggle()}
          className="group relative inline-flex h-11 w-12 shrink-0 items-center justify-center disabled:cursor-not-allowed"
        >
          <span
            aria-hidden="true"
            className={cx(
              "relative h-5 w-9 rounded-full transition-colors duration-150 motion-reduce:transition-none group-disabled:opacity-45",
              checked ? "bg-action" : "bg-border-strong",
            )}
          >
            <span
              className={cx(
                "absolute left-0.5 top-0.5 size-4 rounded-full bg-on-solid transition-transform duration-150 motion-reduce:transition-none",
                checked && "translate-x-4",
              )}
            />
          </span>
        </Pressable>
      </div>
    </Card>
  );
};

export default BranchCashboxDebtCard;
