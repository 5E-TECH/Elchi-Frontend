// dizayn-v2: manager-scan-result, registrator-scan-result
import { RefreshCw, ScanLine, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button, Card, EmptyState, Spinner, buttonClasses } from "../../../shared/ui/primitives";
import { SCANNER_ROUTE } from "../model/routes";

/**
 * «Sahifa holatlari» (maket `manager-scan-result`, `registrator-scan-result`): yuklanish — spinner +
 * «Buyurtma ma'lumotlari yuklanmoqda»; topilmadi / xato — xato ikonkasi, sarlavha, sabab, «Qayta urinish»
 * va asosiy «Skanerga qaytish». Kamera ekranidagi variantlar (`courier-scan-not-found`) — kamera ishi.
 */
export const ScanLoadingCard = ({ text }: { text: string }) => (
  <Card>
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 text-center">
      <Spinner size="lg" className="text-action" />
      <p className="text-sm font-semibold text-text">{text}</p>
    </div>
  </Card>
);

export const ScanNotFoundCard = ({
  title,
  text,
  onRetry,
  retrying = false,
}: {
  title: string;
  text: string;
  onRetry: () => void;
  retrying?: boolean;
}) => {
  const { t } = useTranslation("scan");
  return (
    <Card>
      <EmptyState
        role="alert"
        tone="danger"
        icon={TriangleAlert}
        title={title}
        titleAs="h1"
        description={text}
        action={
          <div className="flex flex-wrap items-center justify-center gap-2 max-md:w-full max-md:flex-col max-md:items-stretch">
            <Button variant="secondary" leftIcon={RefreshCw} loading={retrying} onClick={onRetry}>
              {t("retry")}
            </Button>
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
