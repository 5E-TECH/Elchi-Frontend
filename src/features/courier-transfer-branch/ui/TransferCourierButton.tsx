import { useState } from "react";
import { useSelector } from "react-redux";
import { ArrowRightLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RootState } from "../../../app/config/store";
import { Button } from "../../../shared/ui/primitives";
import TransferCourierModal from "./TransferCourierModal";

interface TransferCourierButtonProps {
  courierId: string;
  courierName?: string;
  /**
   * `row` — filial xodimlari jadvalidagi eski (v1) ikonka; `header` — eski (v1) sarlavha tugmasi.
   * `secondary` / `ghost` — dizayn v2 `Button` («Boshqa filialga o'tkazish», ikonka + matn).
   * Berilmasa — `secondary` (v2).
   */
  variant?: "row" | "header" | "secondary" | "ghost";
  /** Faqat v2 turlari uchun: `sm` 32 (jadval qatori), `md` 40 (sukut, sahifa sarlavhasi). */
  size?: "sm" | "md";
  /** Faqat v2 turlari uchun: to'liq kenglik (telefon kartasi, maket `el-btn-block`). */
  fullWidth?: boolean;
}

/**
 * "Boshqa filialga o'tkazish" — faqat superadmin/admin uchun (server ham
 * `@Roles(SUPERADMIN, ADMIN)` bilan tekshiradi). Oyna faqat ochilganda
 * yaratiladi: yopilganda tanlov tozalanadi, tekshiruv so'rovi to'xtaydi.
 */
const TransferCourierButton = ({
  courierId,
  courierName,
  variant = "secondary",
  size = "md",
  fullWidth,
}: TransferCourierButtonProps) => {
  const { t } = useTranslation("branches");
  const role = useSelector((state: RootState) => state.role.role);
  const [open, setOpen] = useState(false);

  if (role !== "superadmin" && role !== "admin") return null;

  const handleOpen = () => setOpen(true);

  let button;
  if (variant === "secondary" || variant === "ghost") {
    // Dizayn v2: maket `superadmin-users-detail` (sarlavha, secondary) va `superadmin-branches-detail`
    // (xodim qatori, secondary sm; telefonda to'liq kenglik). Bir nechta qatorda ism bilan aria-label.
    button = (
      <Button
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        leftIcon={ArrowRightLeft}
        onClick={handleOpen}
        aria-label={
          courierName
            ? t("courierTransfer.openButtonFor", { name: courierName })
            : t("courierTransfer.rowButton")
        }
      >
        {t("courierTransfer.rowButton")}
      </Button>
    );
  } else if (variant === "row") {
    button = (
      <button
        type="button"
        onClick={handleOpen}
        aria-label={t("courierTransfer.rowButton")}
        title={t("courierTransfer.rowButton")}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-main/30 bg-main/10 p-0 text-main transition-colors hover:border-main/60 hover:bg-main/20 dark:border-main/40 dark:bg-main/15 dark:text-white dark:hover:bg-main/25"
      >
        <ArrowRightLeft size={16} />
      </button>
    );
  } else {
    button = (
      <button
        type="button"
        onClick={handleOpen}
        aria-label={t("courierTransfer.openButton")}
        title={t("courierTransfer.openButton")}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-main/30 bg-main/10 px-3 text-sm font-bold text-main transition-all duration-200 hover:bg-main/15 active:scale-95 dark:border-main/40 dark:bg-main/15 dark:text-white dark:hover:bg-main/25 sm:px-4"
      >
        <ArrowRightLeft size={15} strokeWidth={2.5} />
        {/* Telefonda faqat ikonka — "Tahrirlash" bilan bir qatorga sig'sin. */}
        <span className="hidden sm:inline">{t("courierTransfer.openButton")}</span>
      </button>
    );
  }

  return (
    <>
      {button}
      {open ? (
        <TransferCourierModal
          open
          onClose={() => setOpen(false)}
          courierId={courierId}
          courierName={courierName}
        />
      ) : null}
    </>
  );
};

export default TransferCourierButton;
