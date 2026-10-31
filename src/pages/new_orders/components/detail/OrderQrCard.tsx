// dizayn-v2: (maket yo'q) superadmin-batches-detail
import { useTranslation } from "react-i18next";
import { formatOrderRef } from "../../../../entities/order";
import { ReceiptQr } from "../../../../features/print-receipts";
import { Card } from "../../../../shared/ui/primitives";
import type { OrderDetail } from "./orderDetailModel";

/**
 * «QR kod» kartasi (TzfF0bmQ): yorlig'i yo'qolgan buyurtmani shu koddan skanerlash uchun. Tafsilot maketlarida
 * yo'q — naqsh paket kartasidan (`*-batches-detail`, `BatchQrCard`). `ReceiptQr` — chekdagi bilan aynan bir xil
 * kod. QR har mavzuda och fonda, aks holda skaner o'qimaydi. Tokensiz buyurtmada karta chizilmaydi.
 */
export const OrderQrCard = ({ order, className }: { order: OrderDetail; className?: string }) => {
  const { t } = useTranslation("newOrders");
  const token = order.qr_code_token?.trim();
  if (!token) return null;
  const id = formatOrderRef(order, order.id);

  return (
    <Card
      title={t("orderQr.title")}
      actions={<span className="text-[13px] text-text-muted">{id}</span>}
      className={className}
      bodyClassName="flex flex-col items-center gap-3"
    >
      <div className="flex max-w-full rounded-xl border border-dashed border-border-strong bg-nav-text p-3">
        <ReceiptQr
          token={token}
          label={t("orderQr.image", { id })}
          className="block aspect-square w-[160px] max-w-full text-nav"
        />
      </div>
      <p className="text-center text-[13px] text-text-muted">{t("orderQr.hint")}</p>
    </Card>
  );
};
