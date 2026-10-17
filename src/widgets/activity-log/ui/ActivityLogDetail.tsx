// dizayn-v2: superadmin-activity-logs-row-expanded, admin-activity-logs-row-expanded
import { memo } from "react";
import { Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ActivityLog } from "../../../entities/activity-log";
import { notify } from "../../../shared/lib/notify";
import { IconButton } from "../../../shared/ui/primitives";
import { changedKeys, displayValue, metadataEntries, type Translate } from "../lib/logView";

/**
 * Ochilgan jurnal qatori (maket `*-activity-logs-row-expanded`): chapda «Maydon o'zgarishlari» (yorliq + kichik
 * `field_key`, «oldin» chizilgan, «keyin» qalin), o'ngda «Qo'shimcha ma'lumot» (metadata kalit/qiymat) va
 * «Kuzatuv ID» (nusxa olish). O'zgarish yo'q — `detail.noChanges`.
 */

const TH = "h-8 pr-4 text-left text-xs font-semibold uppercase tracking-[.04em] text-text-muted last:pr-0";
const TD = "border-t border-border py-2.5 pr-4 align-top last:pr-0";
const KV = "m-0 grid grid-cols-[minmax(88px,30%)_1fr] gap-x-4 gap-y-2.5 text-[13px]";

const ActivityLogDetail = ({ log }: { log: ActivityLog }) => {
  const { t, i18n } = useTranslation("activityLogs");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const translate = t as unknown as Translate;
  const diffKeys = changedKeys(log.old_value, log.new_value);
  const meta = metadataEntries(log);

  const value = (key: string, raw: unknown) => displayValue(raw, { key, entityType: log.entity_type, t: translate, language });
  const fieldLabel = (key: string) => t(`fieldLabels.${key}`, { defaultValue: "" });
  const metaLabel = (key: string) => t(`metaLabels.${key}`, { defaultValue: key });

  const copyTrace = async () => {
    if (!log.trace_id) return;
    try {
      await navigator.clipboard.writeText(log.trace_id);
      notify.success(t("detail.copied"));
    } catch {
      // Clipboard ruxsati yo'q — ID ekranda ko'rinib turibdi, qo'lda belgilab olinadi.
    }
  };

  return (
    <div className="flex flex-wrap gap-x-10 gap-y-5">
      <div className="flex min-w-0 flex-[3_1_400px] flex-col gap-2">
        <h3 className="text-sm font-semibold text-text">{t("detail.changes")}</h3>
        {diffKeys.length > 0 ? (
          <div className="min-w-0 overflow-x-auto">
            <table aria-label={t("detail.changes")} className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
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
                  const label = fieldLabel(key);
                  return (
                    <tr key={key}>
                      <td className={TD}>
                        <div className="font-semibold text-text">{label || key}</div>
                        {label ? <div className="text-xs text-text-muted">{key}</div> : null}
                      </td>
                      <td className={TD}>
                        <span className="text-text-muted line-through wrap-anywhere">{value(key, log.old_value?.[key])}</span>
                      </td>
                      <td className={TD}>
                        <span className="font-semibold text-text wrap-anywhere">{value(key, log.new_value?.[key])}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[13px] text-text-muted">{t("detail.noChanges")}</p>
        )}
      </div>

      {meta.length > 0 || log.trace_id ? (
        <div className="flex min-w-0 flex-[2_1_340px] flex-col gap-2">
          <h3 className="text-sm font-semibold text-text">{t("detail.metadata")}</h3>
          {meta.length > 0 ? (
            <dl className={`${KV} pt-1`}>
              {meta.map(([key, raw]) => (
                <div key={key} className="contents">
                  <dt className="text-text-muted">{metaLabel(key)}</dt>
                  <dd className="m-0 min-w-0 font-semibold text-text wrap-anywhere">{value(key, raw)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {log.trace_id ? (
            <dl className={`${KV} mt-1 items-center border-t border-border pt-3`}>
              <dt className="text-text-muted">{t("detail.traceId")}</dt>
              <dd className="m-0 flex min-w-0 items-center gap-1">
                <span className="min-w-0 font-medium text-text break-all">{log.trace_id}</span>
                <IconButton
                  size="sm"
                  icon={Copy}
                  label={t("detail.copyTrace")}
                  onClick={() => void copyTrace()}
                  className="flex-none"
                />
              </dd>
            </dl>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default memo(ActivityLogDetail);
