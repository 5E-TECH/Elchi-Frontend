import { useTranslation } from "react-i18next";
import { formatCancelHandoverMethod, type CancelHandoverInfo } from "../model/cancelReturnStage";
import { ORDER_STATUS_NS } from "../model/statusRegistry";

/** Topshirish usuli matni: «QR orqali», «Qo'lda tasdiq — QR yirtilgan», «QR'siz (market sozlamasi)». */
export const useCancelHandoverMethodLabel = () => {
  const { t } = useTranslation(ORDER_STATUS_NS);
  return (info: CancelHandoverInfo | null): string | null =>
    formatCancelHandoverMethod((key, options) => t(key, options), info);
};
