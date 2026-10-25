// dizayn-v2: manager-payments-cash-detail-courier-shift-closed, manager-payments-cash-detail-branch-shift-closed
import { memo, type ReactNode } from "react";
import { Info, Timer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, Card } from "../../../shared/ui/primitives";
import ShiftBanner from "./ShiftBanner";

/**
 * KASSA AMALI — SMENA YOPIQ (maketlar `manager-payments-cash-detail-{courier,branch}-shift-closed`).
 *
 * Forma o'rnida: karta sarlavhasi (forma nomi) + «Smena ochilgach ishlaydi»; «Smena boshlanmagan» banneri (qaysi
 * amal qulf ekani — kassa turiga qarab), asosiy blok tugma «Smenani ochish» (ochish oynasi) va «Balans va
 * operatsiyalar tarixi ko'rinib turadi.» izohi. Tarix va balans kartalari o'zgarmaydi.
 * Superadmin/admin kassa tafsilotida (asosiy kassa smenasi yo'q) ham ayni blok — «Maket yo'q — eng yaqini:
 * `manager-payments-cash-detail-courier-shift-closed`».
 */

type ShiftLockedCardProps = {
  /** Forma sarlavhasi («Kuryerdan qabul qilish», «Marketga to'lov» …). */
  title: ReactNode;
  /** Banner izohi: qaysi amal smena ochilgach ishlaydi. */
  description: ReactNode;
  onOpenShift: () => void;
};

const ShiftLockedCard = ({ title, description, onOpenShift }: ShiftLockedCardProps) => {
  const { t } = useTranslation("payments");
  return (
    <Card
      as="section"
      title={title}
      description={t("cashDetail.shift.formLocked")}
      bodyClassName="flex flex-col gap-4"
      data-testid="shift-locked-card"
    >
      <ShiftBanner description={description} />
      <Button size="lg" fullWidth leftIcon={Timer} aria-haspopup="dialog" onClick={onOpenShift}>
        {t("v2MainCashbox.openShift")}
      </Button>
      <p className="m-0 flex items-start gap-2 text-xs text-text-muted">
        <Info aria-hidden="true" size={16} className="shrink-0" />
        <span className="min-w-0">{t("cashDetail.shift.visibleHint")}</span>
      </p>
    </Card>
  );
};

export default memo(ShiftLockedCard);
