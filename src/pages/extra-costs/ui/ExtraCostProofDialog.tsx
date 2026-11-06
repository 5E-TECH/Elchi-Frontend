// dizayn-v2: (maket yo'q) superadmin-orders-detail
import { memo, useMemo } from "react";
import { FileImage } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatOrderRef, ProofGallery } from "../../../entities/order";
import type { ExtraCostRow } from "../../../entities/orders/extraCosts";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { Button, Dialog } from "../../../shared/ui/primitives";
import { extraCostProofSources } from "../model/extraCostsView";

type Props = {
  row: ExtraCostRow;
  open: boolean;
  onClose: () => void;
  /** Yopilish harakati tugagach (holatni tozalash uchun). */
  onExited?: () => void;
};

/**
 * QO'SHIMCHA XARAJAT ISBOTI (GykuOz8f) — «Isbot (N)» bosilganda: so'rovga biriktirilgan rasm / video galereyasi
 * (`ProofGallery`, plitka bosilsa — kattalashtirib ko'rish, oldingi / keyingi). Fayllar so'rovning o'z yo'lidan
 * (`GET orders/extra-costs/:id/proofs/:index`) — kutilayotgan, rad etilgan va yopilgan so'rov isboti ham, market
 * operatoriga ham ochiladi (`files/:key/content` qoidasi bunga yetmaydi).
 *
 * Maket yo'q — eng yaqini buyurtma tafsilotidagi «Dalillar» kartasi (`superadmin-orders-detail`); oyna telefonda pastki
 * varaqa (`Dialog`).
 */
export const ExtraCostProofDialog = memo(({ row, open, onClose, onExited }: Props) => {
  const { t, i18n } = useTranslation("extraCosts");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const sources = useMemo(() => extraCostProofSources(row), [row]);
  const ref = formatOrderRef({ id: row.order_id, order_number: row.order_number });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onExited={onExited}
      size="md"
      title={t("proofTitle", { ref })}
      description={t("proofDescription", {
        action: t(`action.${row.action}`),
        amount: formatMoneyLocalized(row.amount, { language }),
      })}
      icon={FileImage}
      footer={
        <Button variant="secondary" className="max-md:flex-1" onClick={onClose}>
          {t("close")}
        </Button>
      }
    >
      <ProofGallery sources={sources} />
    </Dialog>
  );
});
ExtraCostProofDialog.displayName = "ExtraCostProofDialog";
