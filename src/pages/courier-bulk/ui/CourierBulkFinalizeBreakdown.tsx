// dizayn-v2: courier-courier-bulk-confirm-dialog (kuryerlar jadvali maketda yo'q — eng yaqini `tizim-states-forms`)
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import type { CourierBulkFinalizeGroup } from "../model/courierBulk";

type Props = {
  groups: ReadonlyArray<CourierBulkFinalizeGroup>;
  /** Katagi olib tashlangan guruhlar — ularning buyurtmalariga so'rov ketmaydi. */
  excluded: ReadonlySet<string>;
  /** Har qatorda katak (menejer, ≥ 2 guruh). */
  selectable: boolean;
  onToggle: (key: string, included: boolean) => void;
  disabled?: boolean;
};

const CELL = "px-2 py-2.5 text-right tabular-nums";
const COUNT_CELL = cx(CELL, "max-sm:hidden");

/**
 * «Kunni yakunlash» tasdiq oynasidagi kuryerlar jadvali (audit #4): kimning nomidan nechta buyurtma sotiladi, bekor
 * qilinadi, kutilmoqda qoladi va kimning kassasiga qancha naqd yoziladi. Menejer bir bosishda filialdagi barcha
 * kuryerlarning kunini yakunlaydi — kuni hali tugamagan kuryerni (uning «Bekor» skanlari o'z telefonida) katak bilan
 * chiqarib qo'yadi: uning buyurtmalariga tegilmaydi. Oxirgi tanlangan guruhni olib bo'lmaydi (bo'sh yakunlash yo'q —
 * buning uchun «Orqaga»).
 *
 * «Kassaga» — sotiladiganlar narxi yig'indisi (mijozdan olinadigan naqd); kuryer ulushi keyin hisob-kitobda
 * ayriladi (tarif FE'da yo'q). Telefonda son ustunlari yashirinadi — sonlar ism ostida bir qatorda.
 */
export const CourierBulkFinalizeBreakdown = ({ groups, excluded, selectable, onToggle, disabled = false }: Props) => {
  const { t, i18n } = useTranslation("courierBulk");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const titleId = useId();
  const num = (value: number) => formatNumberLocalized(value, { language });
  const money = (value: number) => formatMoneyLocalized(value, { language });

  const includedGroups = groups.filter((group) => !excluded.has(group.key));
  const total = includedGroups.reduce(
    (sum, group) => ({
      sold: sum.sold + group.sold,
      cancel: sum.cancel + group.cancel,
      kept: sum.kept + group.kept,
      cents: sum.cents + Math.round(group.soldAmount * 100),
    }),
    { sold: 0, cancel: 0, kept: 0, cents: 0 },
  );

  const labelOf = (group: CourierBulkFinalizeGroup) => {
    if (group.kind === "self") return t("confirm.breakdown.self");
    if (group.kind === "branch") return t("confirm.breakdown.branch");
    if (group.name) return group.name;
    return group.courierId
      ? t("confirm.breakdown.courierId", { id: group.courierId })
      : t("confirm.breakdown.unknownCourier");
  };

  const cashboxOf = (group: CourierBulkFinalizeGroup) =>
    t(
      group.kind === "self"
        ? "confirm.breakdown.toOwnCashbox"
        : group.kind === "branch"
          ? "confirm.breakdown.toBranchCashbox"
          : "confirm.breakdown.toCourierCashbox",
    );

  const countClass = (value: number, tone: string, included: boolean) =>
    cx(COUNT_CELL, value > 0 && included ? tone : "text-text-muted");

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2" data-testid="courier-bulk-breakdown">
      <div className="flex flex-col gap-0.5">
        <h3 id={titleId} className="m-0 text-sm font-semibold text-text">
          {t("confirm.breakdown.title")}
        </h3>
        {selectable ? <p className="m-0 text-[13px] text-text-muted">{t("confirm.breakdown.selectHint")}</p> : null}
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-sunken text-[12px] text-text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-semibold">
                {t("confirm.breakdown.courier")}
              </th>
              <th scope="col" className={cx(COUNT_CELL, "py-2 font-semibold")}>
                {t("confirm.breakdown.sold")}
              </th>
              <th scope="col" className={cx(COUNT_CELL, "py-2 font-semibold")}>
                {t("confirm.breakdown.cancel")}
              </th>
              <th scope="col" className={cx(COUNT_CELL, "py-2 font-semibold")}>
                {t("confirm.breakdown.kept")}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">
                {t("confirm.breakdown.amount")}
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const included = !excluded.has(group.key);
              const label = labelOf(group);
              // Oxirgi tanlangan guruh — olib bo'lmaydi (hech narsa yuborilmaydigan yakunlash o'rniga «Orqaga»).
              const locked = included && includedGroups.length === 1;
              const name = (
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className={cx("font-semibold break-words", included ? "text-text" : "text-text-muted")}>
                    {label}
                  </span>
                  <span className="text-[12px] text-text-muted">
                    {included ? cashboxOf(group) : t("confirm.breakdown.skipped")}
                  </span>
                  <span className="text-[12px] text-text-muted sm:hidden">
                    {t("confirm.breakdown.counts", {
                      sold: num(group.sold),
                      cancel: num(group.cancel),
                      kept: num(group.kept),
                    })}
                  </span>
                </span>
              );
              return (
                <tr
                  key={group.key}
                  className="border-t border-border align-top"
                  data-testid="courier-bulk-breakdown-row"
                  data-group={group.key}
                  data-included={included}
                >
                  <td className="px-3 py-2.5">
                    {selectable ? (
                      <label
                        className={cx(
                          "flex items-start gap-2.5",
                          disabled || locked ? "cursor-not-allowed" : "cursor-pointer",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={included}
                          disabled={disabled || locked}
                          aria-label={t("confirm.breakdown.include", { name: label })}
                          onChange={(event) => onToggle(group.key, event.target.checked)}
                          className="mt-px size-[18px] shrink-0 cursor-[inherit] accent-action"
                        />
                        {name}
                      </label>
                    ) : (
                      name
                    )}
                  </td>
                  <td className={countClass(group.sold, "text-success-fg", included)}>{num(group.sold)}</td>
                  <td className={countClass(group.cancel, "text-danger-fg", included)}>{num(group.cancel)}</td>
                  <td className={countClass(group.kept, "text-warning-fg", included)}>{num(group.kept)}</td>
                  <td
                    className={cx(
                      "px-3 py-2.5 text-right whitespace-nowrap tabular-nums",
                      included ? "font-semibold text-text" : "text-text-muted line-through",
                    )}
                  >
                    {money(group.soldAmount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {groups.length > 1 ? (
            <tfoot className="bg-sunken">
              <tr className="border-t border-border" data-testid="courier-bulk-breakdown-total">
                <th scope="row" className="px-3 py-2.5 text-left font-semibold text-text">
                  {t("confirm.breakdown.total")}
                  <span className="block text-[12px] font-normal text-text-muted sm:hidden">
                    {t("confirm.breakdown.counts", {
                      sold: num(total.sold),
                      cancel: num(total.cancel),
                      kept: num(total.kept),
                    })}
                  </span>
                </th>
                <td className={cx(COUNT_CELL, "font-semibold text-text")}>{num(total.sold)}</td>
                <td className={cx(COUNT_CELL, "font-semibold text-text")}>{num(total.cancel)}</td>
                <td className={cx(COUNT_CELL, "font-semibold text-text")}>{num(total.kept)}</td>
                <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap text-text tabular-nums">
                  {money(total.cents / 100)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
  );
};
