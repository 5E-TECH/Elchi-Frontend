// dizayn-v2: superadmin-regions-districts-delete-blocked, admin-regions-districts-delete-blocked
import { useState } from "react";
import { Merge, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, Dialog } from "../../../shared/ui/primitives";
import type { MergeCounts, MergeDistrict } from "../model/districtMerge";
import { CountBlock, DialogNote, DistrictSummary } from "./DistrictMergeDialog";

export type DistrictDeleteBlockedDialogProps = {
  /** O'chirib bo'lmagan tuman (DELETE 400); `null` — yopiq. */
  district: MergeDistrict | null;
  /** 400 javobidagi `data.usage` (tirik sonlar, AF0fvJbw); yo'q bo'lsa — «Bog'langan» bloki chizilmaydi. */
  usage?: MergeCounts | null;
  onClose: () => void;
  /** «Birlashtirish» — shu tuman manba bo'lib birlashtirish oynasi ochiladi. */
  onMerge: (district: MergeDistrict) => void;
};

/**
 * «TUMANNI O'CHIRIB BO'LMAYDI» (oNAE3LW9) — `DELETE district/:id` 400 (tumanga buyurtma, foydalanuvchi yoki
 * filial bog'langan). Oyna holat kodi bo'yicha ochiladi; «Bog'langan» sonlari — javobdagi `data.usage` dan
 * (DM-2; yo'q yoki hammasi 0 bo'lsa blok chizilmaydi). Server matni ko'rsatilmaydi.
 */
const DistrictDeleteBlockedDialog = ({
  district,
  usage = null,
  onClose,
  onMerge,
}: DistrictDeleteBlockedDialogProps) => {
  const { t } = useTranslation("region");
  // Yopilish harakati davomida oxirgi tuman (va sonlari) ko'rinib turadi.
  const [shown, setShown] = useState({ district, usage });
  if (district && (district !== shown.district || usage !== shown.usage)) setShown({ district, usage });
  const view = district ?? shown.district;
  const counts = district ? usage : shown.usage;
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
      <CountBlock
        title={t("v2.districts.deleteBlocked.linked")}
        counts={counts}
        label={t("v2.districts.deleteBlocked.linkedAria")}
      />
      <DialogNote>{t("v2.districts.deleteBlocked.note", { name: view.name })}</DialogNote>
    </Dialog>
  );
};

export default DistrictDeleteBlockedDialog;
