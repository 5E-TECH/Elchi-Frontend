// dizayn-v2: superadmin-activity-logs-row-expanded, admin-activity-logs-row-expanded
import { memo } from "react";
import { Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ActivityLog } from "../../../entities/activity-log";
import { notify } from "../../../shared/lib/notify";
import { IconButton } from "../../../shared/ui/primitives";
import { changedKeys, metadataRows } from "../model/activityDetail";
import type { ActivityLabels } from "../model/useActivityLabels";

/**
 * Ochilgan jurnal yozuvi (maket `superadmin-activity-logs-row-expanded`): chapda «Maydon o'zgarishlari»
 * (Maydon · Oldin · Keyin — eski qiymat chizilgan), o'ngda «Qo'shimcha ma'lumot» (`metadata`: Manba, Filial, …,
 * Qurilma, IP manzil) va nusxalanadigan «Kuzatuv ID». `DataTable expandable.render` ichida chiziladi.
 */

const TH = "h-8 pb-1 pr-4 text-left text-xs font-semibold uppercase tracking-[.04em] text-text-muted last:pr-0";
const TD = "py-2.5 pr-4 align-top last:pr-0";

const ActivityLogDetail = ({ log, labels }: { log: ActivityLog; labels: ActivityLabels }) => {
  const { t } = useTranslation("activityLogs");
  const diffKeys = changedKeys(log.old_value, log.new_value);
  const metadata = metadataRows(log.metadata);

  const copyTraceId = async () => {
    if (!log.trace_id) return;
    try {
      await navigator.clipboard.writeText(log.trace_id);
      notify.success(t("detail.copied"));
    } catch {
      notify.error(t("detail.copyFailed"));
    }
  };

  return (
    // Chekkalar — `DataTable expandable` panelida (jadvalda chevron ustuni bilan tekis, telefonda karta ostida).
    <div className="flex flex-wrap gap-x-10 gap-y-5">
      <section aria-labelledby={`log-${log.id}-changes`} className="flex min-w-0 flex-[3_1_400px] flex-col gap-2">
        <h3 id={`log-${log.id}-changes`} className="text-sm font-semibold text-text">
          {t("detail.changes")}
        </h3>
        {diffKeys.length > 0 ? (
          <table aria-label={t("detail.changes")} className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className={TH}>
                  {t("detail.field")}
                </th>
                <th scope="col" className={TH}>
                  {t("detail.before")}
                </th>
                <th scope="col" className={TH}>
                  {t("detail.after")}
                </th>
              </tr>
            </thead>
            <tbody>
              {diffKeys.map((key) => {
                const label = labels.field(key);
                const before = labels.value(key, log.old_value?.[key], log.entity_type);
                return (
                  <tr key={key} className="border-b border-border last:border-b-0">
                    <td className={TD}>
                      <div className="font-semibold text-text">{label ?? key}</div>
                      {label ? <div className="text-xs text-text-muted">{key}</div> : null}
                    </td>
                    <td className={`${TD} break-words text-text-muted`}>
                      {/* Eski qiymat chizilgan (maket); bo'sh — «—», chiziqsiz. */}
                      <span className={before === "—" ? undefined : "line-through"}>{before}</span>
                    </td>
                    <td className={`${TD} break-words font-semibold text-text`}>
                      {labels.value(key, log.new_value?.[key], log.entity_type)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-[13px] text-text-muted">{t("detail.noChanges")}</p>
        )}
      </section>

      <section aria-labelledby={`log-${log.id}-meta`} className="flex min-w-0 flex-[2_1_340px] flex-col gap-2">
        <h3 id={`log-${log.id}-meta`} className="text-sm font-semibold text-text">
          {t("detail.metadata")}
        </h3>
        <dl className="m-0 grid grid-cols-[minmax(88px,30%)_1fr] gap-x-4 gap-y-2.5 pt-1 text-[13px]">
          {metadata.map(({ key, value, title }) => (
            <div key={key} className="contents">
              <dt className="text-text-muted">{labels.meta(key) ?? key}</dt>
              <dd title={title} className="m-0 min-w-0 break-words font-semibold text-text">
                {labels.value(key, value)}
              </dd>
            </div>
          ))}
        </dl>
        {log.trace_id ? (
          <dl className="m-0 mt-1 grid grid-cols-[minmax(88px,30%)_1fr] items-center gap-x-4 border-t border-border pt-3 text-[13px]">
            <dt className="text-text-muted">{t("detail.traceId")}</dt>
            <dd className="m-0 flex min-w-0 items-center gap-1">
              <span className="min-w-0 break-all font-medium text-text">{log.trace_id}</span>
              <IconButton size="sm" icon={Copy} label={t("detail.copyTraceId")} onClick={() => void copyTraceId()} />
            </dd>
          </dl>
        ) : null}
      </section>
    </div>
  );
};

export default memo(ActivityLogDetail);
