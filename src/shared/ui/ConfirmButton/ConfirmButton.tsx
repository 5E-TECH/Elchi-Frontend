import { Button } from "antd";
import type { ButtonProps } from "antd";
import { memo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { ConfirmDialog, type ConfirmTone } from "../primitives";

interface ConfirmButtonProps extends ButtonProps {
  confirmTitle: ReactNode;
  confirmDescription?: ReactNode;
  onConfirm: () => void | Promise<void>;
  /** Tasdiqlash tugmasi matni — aniq fe'l (sukut: `danger` da «O'chirish», aks holda «Tasdiqlash»). */
  confirmLabel?: string;
  /** Tasdiqlash oynasi rangi (sukut: `danger` → `danger`, aks holda `primary`). */
  confirmTone?: ConfirmTone;
  /** ESKI: v1 rang mavzusi — v2 da e'tiborga olinmaydi. */
  popupTheme?: "default" | "branch";
}

/**
 * ESKI (v1) «TASDIQLAB BAJARISH» TUGMASI — API o'zgarmagan. Tugmaning o'zi hozircha antd (sahifalar
 * 4-bosqichda ko'chadi), tasdiqlash oynasi esa dizayn v2 `ConfirmDialog` (3-bosqich): `onConfirm`
 * tugaguncha tugmalar qulflangan va yuklanishda; xato bo'lsa oyna ochiq qoladi va xato oyna ichida.
 * Yangi kodda `Button` + `useConfirm()`.
 */
const ConfirmButton = ({
  confirmTitle,
  confirmDescription,
  onConfirm,
  confirmLabel,
  confirmTone,
  popupTheme: _popupTheme,
  children,
  ...buttonProps
}: ConfirmButtonProps) => {
  void _popupTheme;
  const { t } = useTranslation("common");
  const [isOpen, setIsOpen] = useState(false);
  const tone: ConfirmTone = confirmTone ?? (buttonProps.danger ? "danger" : "primary");
  const isDescriptionText = typeof confirmDescription === "string" || typeof confirmDescription === "number";

  return (
    <>
      <Button {...buttonProps} onClick={() => setIsOpen(true)}>
        {children}
      </Button>
      <ConfirmDialog
        open={isOpen}
        onCancel={() => setIsOpen(false)}
        onConfirm={async () => {
          await onConfirm();
          setIsOpen(false);
        }}
        loading={Boolean(buttonProps.loading)}
        loadingLabel={t("submitting")}
        tone={tone}
        icon={tone === "danger" ? Trash2 : undefined}
        title={confirmTitle}
        description={isDescriptionText ? confirmDescription : undefined}
        details={!isDescriptionText && confirmDescription != null ? confirmDescription : undefined}
        confirmLabel={confirmLabel ?? (tone === "danger" ? t("delete") : t("confirm"))}
        confirmIcon={tone === "danger" ? Trash2 : undefined}
        cancelLabel={t("cancel")}
      />
    </>
  );
};

export default memo(ConfirmButton);
