// dizayn-v2: superadmin-regions-logist-assignment, admin-regions-logist-assignment
import { Check, Info, SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Logist } from "../../../../../entities/logist";
import { cx } from "../../../../../shared/lib/cx";
import { formatPhone } from "../../../../../shared/lib/formatPhone";
import { Badge, Card, EmptyState, Pressable, TextInput } from "../../../../../shared/ui/primitives";
import { useLogistBadgeText } from "../model/useAssignmentText";
import { LogistAvatar } from "./LogistAvatar";

type LogistListCardProps = {
  /** Qidiruvdan o'tgan logistlar (tartiblangan). */
  logists: readonly Logist[];
  /** Jami logistlar soni (sarlavhadagi «(4)»). */
  total: number;
  counts: ReadonlyMap<string, number>;
  selectedId: string | null;
  onSelect: (logist: Logist) => void;
  search: string;
  onSearchChange: (value: string) => void;
  className?: string;
};

/**
 * «LOGISTLAR (N)» kartasi (desktop va planshet; telefonda — `LogistPicker`): qidiruv (ism yoki telefon), ro'yxat
 * (avatar, ism, telefon, belgi; tanlangan — `action-soft` fonda ✓), pastda «Nofaol logistga viloyat biriktirilmaydi».
 */
export const LogistListCard = ({
  logists,
  total,
  counts,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  className,
}: LogistListCardProps) => {
  const { t } = useTranslation("region");
  const badgeText = useLogistBadgeText();

  return (
    <Card
      padding="none"
      divided
      title={
        <>
          {t("v2.logist.list.title")}{" "}
          <span className="font-semibold text-text-muted">({total})</span>
        </>
      }
      className={cx("overflow-hidden", className)}
    >
      <div className="border-b border-border px-4 py-3">
        <TextInput
          mode="search"
          value={search}
          onValueChange={onSearchChange}
          placeholder={t("v2.logist.list.searchPlaceholder")}
          aria-label={t("v2.logist.list.searchLabel")}
        />
      </div>
      {logists.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={t("v2.logist.list.notFound")}
          description={t("v2.logist.list.notFoundHint")}
        />
      ) : (
        <div role="group" aria-label={t("v2.logist.list.groupLabel")} className="flex flex-col">
          {logists.map((logist) => {
            const selected = logist.id === selectedId;
            const inactive = logist.status === "inactive";
            return (
              <Pressable
                key={logist.id}
                aria-pressed={selected}
                onClick={() => onSelect(logist)}
                className={cx(
                  "flex min-h-14 w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left last:border-b-0",
                  "transition-[background-color] duration-150 motion-reduce:transition-none",
                  selected ? "bg-action-soft" : "hover:bg-row-hover",
                )}
              >
                <LogistAvatar name={logist.name} selected={selected} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span
                    className={cx(
                      "truncate text-sm font-semibold",
                      inactive ? "text-text-muted" : "text-text",
                    )}
                  >
                    {logist.name || "—"}
                  </span>
                  <span className="whitespace-nowrap text-[13px] text-text-muted">
                    {formatPhone(logist.phone_number)}
                  </span>
                </span>
                <Badge>{badgeText(logist, counts.get(logist.id) ?? 0)}</Badge>
                {selected ? (
                  <Check size={18} aria-hidden="true" className="shrink-0 text-action-fg" />
                ) : null}
              </Pressable>
            );
          })}
        </div>
      )}
      <p className="m-0 flex items-start gap-2 border-t border-border px-4 py-3 text-xs text-text-muted">
        <Info size={14} aria-hidden="true" className="mt-px shrink-0" />
        <span>{t("v2.logist.list.inactiveNote")}</span>
      </p>
    </Card>
  );
};
