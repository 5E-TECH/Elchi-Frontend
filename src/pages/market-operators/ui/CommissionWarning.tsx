// dizayn-v2: market-operators-list
import { ListFilter, Percent, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MarketOperator } from "../../../entities/market-operator";
import { Button } from "../../../shared/ui/primitives";
import { joinOperatorNames } from "../model/unsetCommission";

/** `.el-alert.el-tone-warning` (CODE-MAP 2.8), maketda `align-items: center; flex-wrap: wrap`. */
const ALERT = "flex flex-wrap items-center gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-fg";

type CommissionWarningProps = {
  /** Joriy sahifadagi komissiyasiz faol operatorlar (`operatorsWithoutCommission`). */
  operators: readonly MarketOperator[];
  /** 1 ta — «Belgilash»: shu operatorning Komissiya oynasi. */
  onSet: (operator: MarketOperator) => void;
  /** 2+ — «Faqat ularni ko'rsatish» / «Hammasini ko'rsatish» (joriy sahifa ichida, mijoz tomonda). */
  onlyUnset: boolean;
  onToggleOnlyUnset: () => void;
};

/**
 * «KOMISSIYA BELGILANMAGAN — DAROMAD YOZILMAYDI» (maket `market-operators-list`). 1 ta operator — ismi bilan va
 * «Belgilash»; 2+ — «N ta operatorda …», ismlar (ko'pi bilan 3 + «yana N ta») va «Faqat ularni ko'rsatish».
 * Backendda komissiya filtri yo'q — ogohlantirish va filtr faqat joriy sahifani ko'radi.
 */
export const CommissionWarning = ({ operators, onSet, onlyUnset, onToggleOnlyUnset }: CommissionWarningProps) => {
  const { t } = useTranslation("marketOperators");
  if (operators.length === 0) return null;
  const single = operators.length === 1 ? operators[0] : null;

  const names = joinOperatorNames(
    operators.map((operator) => operator.name),
    { and: t("warning.and"), more: (count) => t("warning.more", { count }) },
  );

  return (
    <div role="status" className={ALERT}>
      <TriangleAlert size={20} aria-hidden="true" className="shrink-0" />
      <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-0.5 text-text">
        <p className="m-0 font-bold">
          {single ? t("warning.singleTitle") : t("warning.manyTitle", { count: operators.length })}
        </p>
        <p className="m-0 text-[13px]">
          {single ? t("warning.singleText", { name: single.name }) : t("warning.manyText", { names })}
        </p>
      </div>
      {single ? (
        <Button
          variant="secondary"
          size="sm"
          leftIcon={Percent}
          aria-haspopup="dialog"
          className="shrink-0"
          onClick={() => onSet(single)}
        >
          {t("warning.set")}
        </Button>
      ) : (
        <Button variant="secondary" size="sm" leftIcon={ListFilter} className="shrink-0" onClick={onToggleOnlyUnset}>
          {onlyUnset ? t("warning.showAll") : t("warning.showOnly")}
        </Button>
      )}
    </div>
  );
};

export default CommissionWarning;
