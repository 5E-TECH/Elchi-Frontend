// dizayn-v2: superadmin-batches-detail, admin-batches-detail, manager-batches-detail-send, manager-batches-detail-readonly, manager-returns-batch-detail
import type { ReactNode } from "react";
import { Printer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { Button, Card } from "../../../shared/ui/primitives";
import BatchQrCode from "./BatchQrCode";

type Props = {
  /** «B-172». */
  displayId: string;
  token?: string | null;
  /** Varaq izohi (faqat jo'natish rejimida; planshet/telefonda ko'rinishi `hintClassName` bilan). */
  hint?: ReactNode;
  hintClassName?: string;
  onPrint: () => void;
  className?: string;
};

/**
 * «QR KOD» kartasi (maket `*-batches-detail*`): o'ngda paket raqami, QR (`api.qrserver.com`, ochilmasa — zaxira
 * yozuv) chiziqli ramkada va «Chop etish» (A5 varaq — `BatchPrintSheet`). Izoh bo'lsa (jo'natish rejimi) QR yonida,
 * aks holda QR markazda va tugma pastda.
 */
const BatchQrCard = ({ displayId, token, hint, hintClassName, onPrint, className }: Props) => {
  const { t } = useTranslation("batches");

  return (
    <Card
      title={t("detail.qrCode")}
      actions={<span className="text-[13px] text-text-muted">{displayId}</span>}
      className={cx("min-w-0", className)}
      bodyClassName={cx(
        "flex flex-1 gap-4",
        hint
          ? "flex-wrap content-between items-center justify-center gap-x-6"
          : "flex-col items-center justify-between",
      )}
    >
      {/* QR har mavzuda och fonda (skaner o'qishi uchun) — maketdagi `--sidebar-text` (`bg-nav-text`), modullar `nav`. */}
      <div className={cx("flex max-w-full rounded-xl border border-dashed border-border-strong bg-nav-text p-3", !hint && "my-auto")}>
        <BatchQrCode
          token={token}
          fallbackLabel={displayId}
          alt={t("detail.qrImage", { id: displayId })}
          className="aspect-square w-[188px] max-w-full object-contain"
          fallbackClassName="flex aspect-square w-[188px] max-w-full flex-col items-center justify-center gap-1 text-center text-sm font-semibold text-nav"
          fallbackLabelClassName="text-[13px] font-medium"
        />
      </div>
      <div className={cx("flex min-w-0 flex-col gap-3", hint ? "flex-[1_1_240px]" : "w-full")}>
        {hint ? <p className={cx("text-[13px] text-text-muted", hintClassName)}>{hint}</p> : null}
        <Button variant="secondary" leftIcon={Printer} fullWidth onClick={onPrint}>
          {t("detail.print")}
        </Button>
      </div>
    </Card>
  );
};

export default BatchQrCard;
