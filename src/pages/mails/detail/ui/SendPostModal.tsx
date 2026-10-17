// dizayn-v2: superadmin-mails-detail-send-dialog, admin-mails-send-branch-dialog, registrator-mails-detail-send-dialog
import { memo, useId, useState } from "react";
import { Phone, Send, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/config/store";
import { useAppNotification } from "../../../../app/providers/notification/NotificationProvider";
import { useDispatchPostToBranch } from "../../../../entities/mails";
import type { Branch } from "../../../../entities/branch";
import { cx } from "../../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { formatPhone } from "../../../../shared/lib/formatPhone";
import { notify } from "../../../../shared/lib/notify";
import { Button, Dialog } from "../../../../shared/ui/primitives";

/**
 * POCHTANI FILIALGA JO'NATISH — «Filialni tanlang» oynasi (`Dialog`, telefonda pastki varaqa).
 *
 * Maketlar: `superadmin-mails-detail-send-dialog`, `admin-mails-send-branch-dialog`,
 * `registrator-mails-detail-send-dialog`. Viloyatdagi faol filiallar radio kartalar (`.el-choice-card`):
 * nom va telefon; menejeri yo'q filial o'chiq va izohli (registratorda «adminga murojaat qiling»).
 * Pastda «Bekor qilish» va «Jo'natish — n ta».
 *
 * So'rov: `POST branches/posts/:id/dispatch { destination_branch_id, order_ids }` (`useDispatchPostToBranch`).
 * Menejer tekshiruvi yuborishda ham qoladi (backend bilan bir xil). So'rov ketayotganda oyna yopilmaydi.
 */
interface SendPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  branches: Branch[];
  selectedIds: Set<string>;
  onSuccess: (sentIds?: string[]) => void;
  /** Viloyat nomi — ro'yxat sarlavhasi («Qashqadaryo viloyatidagi faol filiallar»). */
  regionName?: string | null;
}

/** Nomi allaqachon tur so'zi bilan tugasa («Toshkent sh.», «… viloyati») — «viloyatidagi» qo'shilmaydi. */
const REGION_WITH_KIND = /(viloyati|sh\.|shahri|shahar|respublikasi)$/i;

const SendPostModal = memo(
  ({ isOpen, onClose, postId, branches, selectedIds, onSuccess, regionName }: SendPostModalProps) => {
    const { t, i18n } = useTranslation("mails");
    const language = i18n.resolvedLanguage ?? i18n.language;
    const { apiRequest } = useAppNotification();
    const role = useSelector((state: RootState) => state.role.role);
    const dispatchPostToBranch = useDispatchPostToBranch();
    const [branchId, setBranchId] = useState("");
    const groupName = useId();

    const orderIds = Array.from(selectedIds);
    const orderCount = orderIds.length;
    const value = formatNumberLocalized(orderCount, { language });
    const isPending = dispatchPostToBranch.isPending;
    const open = isOpen && branches.length > 0;

    // Tanlov yopilganda tozalanadi — keyingi ochilishda avvalgisi qolmaydi.
    const close = () => {
      if (isPending) return;
      setBranchId("");
      dispatchPostToBranch.reset();
      onClose();
    };

    const region = regionName?.trim() || branches[0]?.region?.name?.trim() || "";
    const legend = !region
      ? t("detailPage.sendDialog.legendNoRegion")
      : REGION_WITH_KIND.test(region)
        ? t("detailPage.sendDialog.legendPlain", { region })
        : t("detailPage.sendDialog.legend", { region });
    const noManagerHint = t(
      role === "registrator" ? "detailPage.sendDialog.noManagerRegistrator" : "detailPage.sendDialog.noManager",
    );

    const submit = () => {
      if (!branchId || isPending) return;

      const branch = branches.find((item) => item.id === branchId);
      if (!branch?.has_manager) {
        notify.error(t("branchManagerRequiredTitle"), { description: t("branchManagerRequiredDescription") });
        return;
      }

      void apiRequest({
        request: () =>
          dispatchPostToBranch.mutateAsync({
            postId,
            payload: { destinationBranchId: branchId, orderIds },
          }),
        successMessage: t("sendBranchSuccess", { name: branch.name ?? "" }),
        errorMessage: t("sendError"),
        onSuccess: () => {
          setBranchId("");
          dispatchPostToBranch.reset();
          onSuccess(orderIds);
          onClose();
        },
      });
    };

    return (
      <Dialog
        open={open}
        onClose={close}
        busy={isPending}
        size="md"
        icon={Send}
        title={t("detailPage.sendDialog.title")}
        description={t("detailPage.sendDialog.description", { value, count: orderCount })}
        footer={
          <>
            <Button variant="secondary" disabled={isPending} onClick={close}>
              {t("cancel", { ns: "common" })}
            </Button>
            <Button
              leftIcon={Send}
              disabled={!branchId}
              loading={isPending}
              loadingText={t("sending")}
              onClick={submit}
            >
              {t("detailPage.sendDialog.submit", { value, count: orderCount })}
            </Button>
          </>
        }
      >
        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-xs font-semibold uppercase tracking-[.05em] text-text-muted">{legend}</legend>
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
                      {noManagerHint}
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

SendPostModal.displayName = "SendPostModal";

export default SendPostModal;
