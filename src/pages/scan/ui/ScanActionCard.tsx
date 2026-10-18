// dizayn-v2: manager-scan-result, courier-scan-order-detail, courier-scan-package-detail, courier-scan-post-detail
import type { ReactNode } from "react";
import { Usb, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "../../../shared/ui/primitives";

export type ScanActionHint = { icon: LucideIcon; text: string };

type ScanActionCardProps = {
  /** «Buyurtmani olish» / «Amallar» / «Paketni qabul qilish» / «Pochta bilan ishlash». */
  title: string;
  /** Sarlavha o'ngida (menejer: «Tafsilot» havolasi). */
  headerAction?: ReactNode;
  /** Kartaning birinchi jumlasi (`.el-small .el-muted`). */
  text?: string | null;
  children?: ReactNode;
  /** Pastki izohlar; sukut — «Keyingi posilkani USB skaner bilan o'qisangiz…». */
  hints?: ScanActionHint[];
};

/**
 * Desktop (≥ 1024) yon ustundagi «Amallar» kartasi — maketdagi `aside.el-hide-tablet > .el-card`:
 * sarlavha, izoh jumlasi, `lg` tugmalar (to'liq enli), pastda kulrang ikonkali izohlar.
 */
export const ScanActionCard = ({ title, headerAction, text, children, hints }: ScanActionCardProps) => {
  const { t } = useTranslation("scan");
  const footHints = hints ?? [{ icon: Usb, text: t("usbHint") }];

  return (
    <Card
      padding="none"
      title={title}
      actions={headerAction}
      footer={
        footHints.length > 0 ? (
          <div className="flex w-full min-w-0 flex-col gap-2.5 py-0.5">
            {footHints.map(({ icon: Icon, text: hint }) => (
              <div key={hint} className="flex items-start gap-2.5">
                <Icon size={18} aria-hidden="true" className="mt-px shrink-0 text-text-subtle" />
                <p className="text-[13px] text-text-muted">{hint}</p>
              </div>
            ))}
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4 p-5">
        {text ? <p className="text-[13px] text-text-muted">{text}</p> : null}
        {children}
      </div>
    </Card>
  );
};
