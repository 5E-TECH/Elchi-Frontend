// dizayn-v2: superadmin-regions-districts-delete-blocked
import { useState } from "react";
import { Merge, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, Dialog } from "../../../shared/ui/primitives";
import type { MergeDistrict } from "../model/districtMerge";
import { DialogNote, DistrictSummary } from "./DistrictMergeDialog";

export type DistrictDeleteBlockedDialogProps = {
  /** O'chirib bo'lmagan tuman (DELETE 400); `null` — yopiq. */
  district: MergeDistrict | null;
  onClose: () => void;
  /** «Birlashtirish» — shu tuman manba bo'lib birlashtirish oynasi ochiladi. */
  onMerge: (district: MergeDistrict) => void;
};

/**
 * «TUMANNI O'CHIRIB BO'LMAYDI» (oNAE3LW9) — `DELETE district/:id` 400 (tumanga buyurtma, foydalanuvchi yoki
 * filial bog'langan). Oyna faqat holat kodi bo'yicha ochiladi: gateway xato `data` sini (`usage` sonlari)
 * uzatmaguncha (backend N1) maketdagi «Bog'langan» sonlar bloki chizilmaydi, server matni ko'rsatilmaydi.
 */
const DistrictDeleteBlockedDialog = ({ district, onClose, onMerge }: DistrictDeleteBlockedDialogProps) => {
  const { t } = useTranslation("region");
  // Yopilish harakati davomida oxirgi tuman ko'rinib turadi.
  const [shown, setShown] = useState(district);
  if (district && district !== shown) setShown(district);
  const view = district ?? shown;
  if (!view) return null;

  return (
    <Dialog
      open={district != null}
      onClose={onClose}
      role="alertdialog"
      size="md"
      icon={TriangleAlert}
      iconTone="warning"
      iconShape="circle"
      title={t("v2.districts.deleteBlocked.title", { name: view.name })}
      description={t("v2.districts.deleteBlocked.text")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("v2.districts.deleteBlocked.close")}
          </Button>
          <Button variant="primary" leftIcon={Merge} aria-haspopup="dialog" onClick={() => onMerge(view)}>
            {t("v2.districts.deleteBlocked.merge")}
          </Button>
        </>
      }
    >
      <DistrictSummary title={view.name} subtitle={view.regionName} />
      <DialogNote>{t("v2.districts.deleteBlocked.note", { name: view.name })}</DialogNote>
    </Dialog>
  );
};

export default DistrictDeleteBlockedDialog;
