// dizayn-v2: superadmin-regions-logist-assignment, admin-regions-logist-assignment
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Logist } from "../../../../../entities/logist";
import { cx } from "../../../../../shared/lib/cx";
import { formatPhone } from "../../../../../shared/lib/formatPhone";
import { Badge, Field, Select, type SelectOption } from "../../../../../shared/ui/primitives";
import { useLogistBadgeText } from "../model/useAssignmentText";

type LogistPickerProps = {
  logists: readonly Logist[];
  counts: ReadonlyMap<string, number>;
  selectedId: string | null;
  onSelect: (logist: Logist) => void;
  className?: string;
};

/**
 * Telefonda «Logist» tanlovi (maket: `Select` — pastki varaqa, qidiruv bilan). Maydonda «Aziz Rahimov · 4 viloyat»,
 * variantda ism + «telefon · 4 viloyat», nofaolda «Nofaol» belgisi.
 */
export const LogistPicker = ({
  logists,
  counts,
  selectedId,
  onSelect,
  className,
}: LogistPickerProps) => {
  const { t } = useTranslation("region");
  const badgeText = useLogistBadgeText();

  const options = useMemo<SelectOption[]>(
    () =>
      logists.map((logist) => {
        const count = counts.get(logist.id) ?? 0;
        const regions =
          count > 0 ? t("v2.logist.list.regionCount", { count }) : t("v2.logist.picker.noRegions");
        return {
          value: logist.id,
          label: `${logist.name || "—"} · ${badgeText(logist, count)}`,
          description:
            logist.status === "inactive"
              ? formatPhone(logist.phone_number)
              : `${formatPhone(logist.phone_number)} · ${regions}`,
          searchText: `${logist.name} ${logist.phone_number}`,
        };
      }),
    [badgeText, counts, logists, t],
  );
  const byId = useMemo(() => new Map(logists.map((logist) => [logist.id, logist])), [logists]);

  return (
    <Field label={t("v2.logist.picker.label")} labelAs="span" className={className}>
      <Select
        searchable
        options={options}
        value={selectedId}
        onChange={(next) => {
          const logist = next ? byId.get(next) : undefined;
          if (logist) onSelect(logist);
        }}
        placeholder={t("v2.logist.list.searchPlaceholder")}
        listLabel={t("v2.logist.list.groupLabel")}
        renderOption={(option) => {
          const logist = byId.get(option.value);
          const inactive = logist?.status === "inactive";
          return (
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={cx("truncate", inactive && "text-text-muted")}>
                  {logist?.name || "—"}
                </span>
                <span className="text-xs font-medium text-text-muted">{option.description}</span>
              </span>
              {inactive ? <Badge>{t("v2.logist.list.inactive")}</Badge> : null}
            </span>
          );
        }}
      />
    </Field>
  );
};
