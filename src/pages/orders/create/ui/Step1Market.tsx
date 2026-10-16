// dizayn-v2: superadmin-neworders-create-manual-step1, superadmin-neworders-create-market-picker-dialog, admin-neworders-create-manual, admin-neworders-create-market-picker, manager-new-orders-create-manual-step1, registrator-new-orders-create-step1, registrator-new-orders-create-market-picker-dialog
import { memo } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, buttonClasses, Card } from "../../../../shared/ui/primitives";
import type { MarketOption } from "../model/orderCreateForm";
import { MarketPickerField } from "./MarketPicker";

interface Step1MarketProps {
  /**
   * Faqat maydon (kartasiz, yorliq yashirin) — AI rejimida market tanlanmaganda (maket `*-create-ai-input`
   * «Market tanlanmagan»).
   */
  compact?: boolean;
  onSelectMarket?: (market: MarketOption) => void;
  /** «Keyingi» faolmi (market tanlangan). */
  canNext?: boolean;
  /** «Keyingi» — 2-qadamga. */
  onNext?: () => void;
  /** «Orqaga» manzili (sukut «Qabul va yaratish»). */
  backTo?: string;
}

/**
 * 1-QADAM — MARKET TANLASH (maket `*-create-manual-step1`): karta «Market tanlang» + izoh, «Market *» maydoni
 * (bosilsa — tanlash oynasi), pastda «Orqaga» · holat qatori (faqat ≥ 768) · «Keyingi» (market tanlanmaguncha
 * o'chiq). Telefonda ikkala tugma bir qatorda, «Keyingi» kengroq.
 */
const Step1Market = ({ compact = false, onSelectMarket, canNext = false, onNext, backTo = "/new-orders" }: Step1MarketProps) => {
  const { t } = useTranslation(["orders", "common"]);

  if (compact) return <MarketPickerField hideLabel onSelectMarket={onSelectMarket} />;

  return (
    <Card
      title={t("selectMarketTitle")}
      description={t("selectMarket")}
      footer={
        <>
          <Link to={backTo} className={buttonClasses({ variant: "secondary" })}>
            <ChevronLeft size={16} aria-hidden="true" />
            {t("back", { ns: "common" })}
          </Link>
          <p
            role="status"
            className="flex min-w-0 flex-1 items-center justify-center gap-1.5 text-center text-[13px] text-text-muted max-md:hidden"
          >
            {canNext ? (
              <>
                <Check size={16} aria-hidden="true" className="shrink-0 text-success-fg" />
                {t("stepReadyMessage")}
              </>
            ) : (
              t("selectMarketFirst")
            )}
          </p>
          <Button rightIcon={ChevronRight} disabled={!canNext} onClick={onNext} className="max-md:flex-1">
            {t("next", { ns: "common" })}
          </Button>
        </>
      }
    >
      <MarketPickerField onSelectMarket={onSelectMarket} />
    </Card>
  );
};

export default memo(Step1Market);
