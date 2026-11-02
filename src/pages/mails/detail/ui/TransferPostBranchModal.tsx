// dizayn-v2: (maket yo'q) admin-mails-send-branch-dialog
import { memo, useId, useState } from "react";
import { ArrowRightLeft, Phone, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppNotification } from "../../../../app/providers/notification/NotificationProvider";
import { useReassignPostToBranch } from "../../../../entities/mails";
import type { Branch } from "../../../../entities/branch";
import { cx } from "../../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { formatPhone } from "../../../../shared/lib/formatPhone";
import { notify } from "../../../../shared/lib/notify";
import { Button, Dialog } from "../../../../shared/ui/primitives";

/**
 * POCHTANI BOSHQA FILIALGA O'TKAZISH — eski pochta (`/mails/:id`, «Eski») → «Filialga o'tkazish».
 *
 * HQ pochtani adashib boshqa filialga jo'natgan, u filial hali qabul qilmagan: shu viloyatning boshqa faol
 * filiallari radio kartalar (`SendPostModal` ro'yxati bilan bir xil: nom, telefon; menejeri yo'q — o'chiq).
 * «O'tkazish» → `POST branches/posts/:id/reassign {destination_branch_id}` — pochta (id o'zgarmaydi) va undagi
 * buyurtmalar tanlangan filialga o'tadi. Rad javobi (qabul qilingan, boshqa viloyat, qamrovda emas) — backend
 * matni bilan. Maket yo'q — eng yaqini: `admin-mails-send-branch-dialog`. So'rov ketayotganda oyna yopilmaydi.
 */
interface TransferPostBranchModalProps {
  postId: string;
  /** Pochta hozir jo'natilgan filial nomi (ro'yxatda yo'q). */
  currentBranchName: string | null;
  /** Shu viloyatning boshqa faol filiallari (hozirgisisiz). */
  branches: Branch[];
  orderCount: number;
  onClose: () => void;
  onSuccess: () => void;
}

const TransferPostBranchModal = memo(
  ({ postId, currentBranchName, branches, orderCount, onClose, onSuccess }: TransferPostBranchModalProps) => {
    const { t, i18n } = useTranslation("mails");
    const language = i18n.resolvedLanguage ?? i18n.language;
    const { apiRequest } = useAppNotification();
    const reassign = useReassignPostToBranch();
    const [branchId, setBranchId] = useState("");
    const groupName = useId();
    const isPending = reassign.isPending;
    const value = formatNumberLocalized(orderCount, { language });

    const close = () => {
      if (isPending) return;
      onClose();
    };

    const submit = () => {
      if (!branchId || isPending) return;
      const branch = branches.find((item) => item.id === branchId);
      if (!branch?.has_manager) {
        notify.error(t("branchManagerRequiredTitle"), { description: t("branchManagerRequiredDescription") });
        return;
      }
      void apiRequest({
        request: () => reassign.mutateAsync({ postId, destinationBranchId: branchId }),
        successMessage: t("detailPage.transferDialog.success", { name: branch.name ?? "" }),
        errorMessage: t("detailPage.transferDialog.error"),
        onSuccess,
      });
    };

    return (
      <Dialog
        open
        onClose={close}
        busy={isPending}
        size="md"
        icon={ArrowRightLeft}
        title={t("detailPage.transferDialog.title")}
        description={
          currentBranchName
            ? t("detailPage.transferDialog.description", { branch: currentBranchName, value, count: orderCount })
            : t("detailPage.transferDialog.descriptionNoBranch", { value, count: orderCount })
        }
        footer={
          <>
            <Button variant="secondary" disabled={isPending} onClick={close}>
              {t("cancel", { ns: "common" })}
            </Button>
            <Button
              leftIcon={ArrowRightLeft}
              disabled={!branchId}
              loading={isPending}
              loadingText={t("detailPage.transferDialog.submitting")}
              onClick={submit}
            >
              {t("detailPage.transferDialog.submit")}
            </Button>
          </>
        }
      >
        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-xs font-semibold uppercase tracking-[.05em] text-text-muted">
            {t("detailPage.transferDialog.legend")}
          </legend>
          {branches.map((branch) => {
            const disabled = !branch.has_manager;
            const phone = formatPhone(branch.phone_number) || branch.phone_number || "—";
            return (
              <label
                key={branch.id}
                className={cx(
                  "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm transition-[background-color,border-color] duration-150 motion-reduce:transition-none",
                  disabled
                    ? "cursor-not-allowed border-border bg-sunken"
                    : "cursor-pointer border-border-strong bg-surface hover:bg-row-hover has-[:checked]:border-action has-[:checked]:bg-action-soft",
                )}
              >
                <input
                  type="radio"
                  name={groupName}
                  value={branch.id}
                  checked={branchId === branch.id}
                  disabled={disabled || isPending}
                  onChange={() => setBranchId(branch.id)}
                  className="mt-0.5 size-[18px] shrink-0 cursor-pointer accent-action disabled:cursor-not-allowed"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={cx("font-semibold", disabled ? "text-text-muted" : "text-text")}>{branch.name}</span>
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-text-muted">
                    <Phone aria-hidden="true" size={14} className="shrink-0" />
                    {phone}
                  </span>
                  {disabled ? (
                    <span className="mt-0.5 inline-flex items-start gap-1.5 text-[13px] text-warning-fg">
                      <TriangleAlert aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
                      {t("detailPage.sendDialog.noManager")}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </fieldset>
      </Dialog>
    );
  },
);

TransferPostBranchModal.displayName = "TransferPostBranchModal";

export default TransferPostBranchModal;
