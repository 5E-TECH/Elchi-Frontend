// dizayn-v2: superadmin-regions-sato-codes-duplicates
import type { ReactNode } from "react";
import { Merge } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { Badge, Button } from "../../../../shared/ui/primitives";
import { useIsPhone } from "../../../../shared/ui/primitives/date/useIsPhone";
import type { SatoDistrictRow, SatoDuplicateGroup } from "../../model/satoModel";

/** `DataTable` bilan bir xil katak klasslari (CODE-MAP 2.6) — guruh sarlavha qatorlari uchun alohida jadval. */
const TH = "h-10 whitespace-nowrap border-b border-border bg-sunken px-4 text-left text-xs font-semibold uppercase tracking-[.04em] text-text-muted";
const TD = "h-14 border-b border-border px-4 py-2 align-middle text-text";

type Props = {
  groups: readonly SatoDuplicateGroup[];
  label: string;
  busy?: boolean;
  /** Tuman, kod va amallar kataklari (inline kod muharriri — `SatoCodesTable`). */
  renderDistrict: (row: SatoDistrictRow) => ReactNode;
  renderCode: (row: SatoDistrictRow) => ReactNode;
  renderActions: (row: SatoDistrictRow) => ReactNode;
  /** Telefondagi yozuv kartasi. */
  renderCard: (row: SatoDistrictRow) => ReactNode;
  /** Qatorning fon klassi (tahrirlanayotgan qator). */
  rowClassName?: (row: SatoDistrictRow) => string | null;
  onMerge: (group: SatoDuplicateGroup) => void;
};

/**
 * «TAKRORIY NOMLAR» (SA-2, maket `superadmin-regions-sato-codes-duplicates`): har guruh — sarlavha qatori (nom,
 * «N ta yozuv», viloyatlar; bitta viloyatda bo'lsa «Birlashtirish», aks holda «Turli viloyatda — birlashtirilmaydi»),
 * ostida yozuvlar (ID, viloyat, SATO kodi, inline muharrir). Telefonda — guruh sarlavhasi va kartalar.
 */
export const SatoDuplicatesTable = ({
  groups,
  label,
  busy,
  renderDistrict,
  renderCode,
  renderActions,
  renderCard,
  rowClassName,
  onMerge,
}: Props) => {
  const { t, i18n } = useTranslation("region");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isPhone = useIsPhone();

  const recordsBadge = (group: SatoDuplicateGroup) => (
    <Badge tone="danger" dot>
      {t("v2.sato.duplicates.records", {
        count: group.rows.length,
        value: formatNumberLocalized(group.rows.length, { language }),
      })}
    </Badge>
  );
  const mergeButton = (group: SatoDuplicateGroup, phone: boolean) => (
    <Button
      variant="secondary"
      size={phone ? "lg" : "sm"}
      fullWidth={phone}
      leftIcon={Merge}
      aria-haspopup="dialog"
      aria-label={t("v2.sato.duplicates.mergeAria", { name: group.name })}
      data-sato-merge={group.key}
      onClick={() => onMerge(group)}
    >
      {t("v2.sato.duplicates.merge")}
    </Button>
  );
  const busyClass = busy && "opacity-60 transition-opacity duration-150 motion-reduce:transition-none";

  if (isPhone)
    return (
      <ul aria-label={label} aria-busy={busy || undefined} className={cx("m-0 flex min-w-0 list-none flex-col p-0", busyClass)}>
        {groups.map((group) => (
          <li key={group.key} className="min-w-0 border-b border-border last:border-b-0">
            <div className="flex flex-col gap-1 border-b border-border bg-sunken px-4 py-3">
              <span className="flex items-center justify-between gap-2">
                <span className="min-w-0 text-sm font-semibold text-text">{group.name}</span>
                {recordsBadge(group)}
              </span>
              <span className="text-xs text-text-muted">
                {group.merge
                  ? group.regionNames.join(", ")
                  : `${group.regionNames.join(", ")} · ${t("v2.sato.duplicates.crossRegion")}`}
              </span>
              {group.merge ? <span className="flex pt-2">{mergeButton(group, true)}</span> : null}
            </div>
            <ul aria-label={group.name} className="m-0 flex list-none flex-col p-0">
              {group.rows.map((row) => (
                <li
                  key={row.id}
                  className={cx("min-w-0 border-b border-border last:border-b-0", rowClassName?.(row))}
                >
                  {renderCard(row)}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    );

  return (
    <div aria-busy={busy || undefined} className={cx("relative min-w-0 overflow-x-auto", busyClass)}>
      <table aria-label={label} className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th scope="col" className={TH}>
              {t("v2.sato.columns.district")}
            </th>
            <th scope="col" className={TH}>
              {t("v2.sato.columns.region")}
            </th>
            <th scope="col" className={TH}>
              {t("v2.sato.columns.satoCode")}
            </th>
            <th scope="col" className={cx(TH, "text-right")}>
              <span className="sr-only">{t("v2.sato.columns.actions")}</span>
            </th>
          </tr>
        </thead>
        {groups.map((group, index) => (
          <tbody key={group.key}>
            <tr>
              <th
                scope="rowgroup"
                colSpan={4}
                className="h-[52px] border-b border-border bg-sunken px-4 py-2 text-left text-sm font-normal text-text"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="font-semibold">{group.name}</span>
                    {recordsBadge(group)}
                    <span className="text-[13px] text-text-muted">{group.regionNames.join(", ")}</span>
                  </span>
                  {group.merge ? (
                    mergeButton(group, false)
                  ) : (
                    <span className="text-[13px] whitespace-nowrap text-text-muted">
                      {t("v2.sato.duplicates.crossRegion")}
                    </span>
                  )}
                </span>
              </th>
            </tr>
            {group.rows.map((row, rowIndex) => {
              const last = index === groups.length - 1 && rowIndex === group.rows.length - 1;
              const td = cx(TD, last && "border-b-0");
              return (
                <tr
                  key={row.id}
                  className={cx(
                    "transition-[background-color] duration-150 hover:bg-row-hover motion-reduce:transition-none",
                    rowClassName?.(row),
                  )}
                >
                  <td className={td}>{renderDistrict(row)}</td>
                  <td className={cx(td, "whitespace-nowrap")}>{row.regionName}</td>
                  <td className={td}>{renderCode(row)}</td>
                  <td className={cx(td, "whitespace-nowrap text-right")}>{renderActions(row)}</td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
};
