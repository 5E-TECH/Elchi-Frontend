// dizayn-v2: superadmin-neworders-incoming-scan-partial, admin-neworders-incoming-scan-partial, manager-new-orders-incoming-scan-partial, registrator-new-orders-incoming-scan-partial
import { useId } from "react";
import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { TONE_FG, TONE_SOFT } from "../../../shared/ui/primitives";
import type { BagProgress } from "../lib";

/**
 * «N TA QOP CHALA KELDI» (maket `*-incoming-scan-partial`, DamKku7C): «Kelgan posilkalar» ustida. Operator kamomadni
 * qabuldan oldin ko'radi: yetishmagan posilka hali mashinada bo'lishi mumkin.
 */
export const PartialBagsAlert = ({ bags }: { bags: readonly BagProgress[] }) => {
  const { t, i18n } = useTranslation("common");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cx("flex items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT.warning)}
    >
      <TriangleAlert size={20} aria-hidden="true" className="mt-px shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 text-text">
        <p className="m-0">
          <span id={titleId} className={cx("font-bold", TONE_FG.warning)}>
            {t("incoming.partialTitle", { value: formatNumberLocalized(bags.length, { language }) })}
          </span>{" "}
          <span className="text-text-muted">· {t("incoming.partialLead")}</span>
        </p>
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {bags.map((bag) => (
            <li key={bag.token} className="[overflow-wrap:anywhere]">
              <span className="font-semibold">{t("incoming.bagLabel", { bag: bag.label })}</span> —{" "}
              {t("incoming.partialBag", { size: bag.size, arrived: bag.arrived })}
            </li>
          ))}
        </ul>
        <p className="m-0 text-[13px] text-text-muted">{t("incoming.partialHint")}</p>
      </div>
    </section>
  );
};

export default PartialBagsAlert;
