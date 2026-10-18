// dizayn-v2: superadmin-users-detail, superadmin-branches-detail
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
  /** Dizayn v2 `Button` turi («Boshqa filialga o'tkazish», ikonka + matn). Berilmasa — `secondary`. */
  variant?: "secondary" | "ghost";
  /** `sm` 32 (jadval qatori), `md` 40 (sukut, sahifa sarlavhasi). */
  size?: "sm" | "md";
  /** To'liq kenglik (telefon kartasi, maket `el-btn-block`). */
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

  // Dizayn v2: maket `superadmin-users-detail` (sarlavha, secondary) va `superadmin-branches-detail`
  // (xodim qatori, secondary sm; telefonda to'liq kenglik). Bir nechta qatorda ism bilan aria-label.
  const button = (
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
