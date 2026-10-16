import { Fragment, isValidElement, memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CircleCheck, TriangleAlert, Trash2 } from "lucide-react";
import { ConfirmDialog, type ConfirmContent } from "../ui/primitives";

interface PopupConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: ReactNode;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  variant?: "danger" | "warning" | "success";
  /** ESKI: v1 rang mavzusi — v2 da e'tiborga olinmaydi. */
  theme?: "default" | "branch";
}

/**
 * v1 `variant` → v2 tasdiqlash oynasi (`tizim-feedback` 06 «Rang»: qizil — o'chirish va bloklash,
 * ko'k — oddiy rozilik). v1 «warning» (sariq) va «success» (yashil) tugmalari maketda ko'k:
 * buyurtmani qaytarish (`manager-orders-rollback-dialog` — sariq ikonka), qo'lda qabul
 * (`manager-new-orders-receive-confirm-dialog`), push ruxsati.
 */
const VARIANT: Record<NonNullable<PopupConfirmProps["variant"]>, Pick<ConfirmContent, "tone" | "icon" | "iconTone">> = {
  danger: { tone: "danger", icon: Trash2, iconTone: "danger" },
  warning: { tone: "primary", icon: TriangleAlert, iconTone: "warning" },
  success: { tone: "primary", icon: CircleCheck, iconTone: "neutral" },
};

/**
 * ESKI (v1) TASDIQLASH OYNASI — API o'zgarmagan, ichi dizayn v2 `ConfirmDialog` (3-bosqich):
 * fokus «Bekor qilish» da, Esc/fon yopadi, `isLoading` da tugmalar qulflanadi va
 * oyna yopilmaydi; telefonda pastki varaqa. Yangi kodda `useConfirm()` yoki `ConfirmDialog`.
 *
 * `message` — matn bo'lsa sarlavha ostidagi izoh, element bo'lsa oyna tanasi (`sunken` quti).
 */
const PopupConfirm = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  isLoading = false,
  variant = "danger",
}: PopupConfirmProps) => {
  const { t } = useTranslation("common");
  const look = VARIANT[variant];
  const resolvedConfirmLabel = confirmLabel ?? (variant === "danger" ? t("delete") : t("confirm"));
  // Matn (yoki matnli fragment) — izoh; boshqa element (ism, tafsilot) — tana.
  const textMessage =
    typeof message === "string" ||
    typeof message === "number" ||
    (isValidElement(message) && message.type === Fragment);

  return (
    <ConfirmDialog
      // v1 roli saqlanadi (sahifa testlari va e2e `getByRole("dialog")`); yangi kodda `useConfirm()` — `alertdialog`.
      role="dialog"
      open={isOpen}
      onCancel={onClose}
      // Va'da qaytarsa (async ishlovchi) — oyna yuklanishni va xatoni o'zi ko'rsatadi.
      onConfirm={onConfirm}
      loading={isLoading}
      loadingLabel={t("submitting")}
      title={title ?? t("confirm")}
      description={textMessage ? message : undefined}
      details={!textMessage && message != null && message !== false ? message : undefined}
      confirmLabel={resolvedConfirmLabel}
      cancelLabel={cancelLabel ?? t("cancel")}
      confirmIcon={variant === "danger" ? Trash2 : undefined}
      {...look}
    />
  );
};

export default memo(PopupConfirm);
