// dizayn-v2: (maket yo'q) manager-scan-result
import { memo } from "react";
import { ScanLine, Store } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { canHandoverCancelledToMarket } from "../../../app/lib/access";
import { Card, EmptyState, buttonClasses } from "../../../shared/ui/primitives";
import { SCANNER_ROUTE } from "../model/routes";

const CANCELLED_HANDOVER_ROUTE = "/new-orders/cancelled";

/**
 * Market QR'i (`MCR-…`) natija sahifasida — maket yo'q, eng yaqini `manager-scan-result` holat kartasi.
 * Bu buyurtma emas: market bekor qilingan buyurtmalarini qaytarib olishda ko'rsatadigan bir martalik kod.
 * Backend uni `POST scan/market-cancelled` da bir marta «yeydi», shuning uchun bu yerda HECH QANDAY so'rov
 * yuborilmaydi — operator Bekor qilinganlar sahifasiga yo'naltiriladi (ruxsati bo'lsa).
 */
const ScanMarketQrNotice = () => {
  const { t } = useTranslation("scan");
  const canHandover = useSelector(canHandoverCancelledToMarket);

  return (
    <Card>
      <EmptyState
        role="status"
        icon={Store}
        title={t("scanner.marketQr.title")}
        titleAs="h1"
        description={t("scanner.marketQr.text")}
        action={
          <div className="flex flex-wrap items-center justify-center gap-2 max-md:w-full max-md:flex-col max-md:items-stretch">
            {canHandover ? (
              <Link to={CANCELLED_HANDOVER_ROUTE} className={buttonClasses({ variant: "secondary" })}>
                <Store size={18} aria-hidden="true" className="shrink-0" />
                {t("scanner.marketQr.open")}
              </Link>
            ) : null}
            <Link to={SCANNER_ROUTE} className={buttonClasses({ variant: "primary" })}>
              <ScanLine size={18} aria-hidden="true" className="shrink-0" />
              {t("backToScanner")}
            </Link>
          </div>
        }
      />
    </Card>
  );
};

export default memo(ScanMarketQrNotice);
