import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { ActivityLog } from "../../../entities/activity-log";

const renderValue = (value: unknown): string => {
  if (value == null) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const changedKeys = (
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string[] => {
  const keys = new Set<string>([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return [...keys].filter((key) => renderValue(before?.[key]) !== renderValue(after?.[key]));
};

const ActivityLogDetail = ({ log }: { log: ActivityLog }) => {
  const { t } = useTranslation("activityLogs");
  const diffKeys = changedKeys(log.old_value, log.new_value);

  return (
    <div className="flex flex-col gap-3 text-sm">
      {diffKeys.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="text-xs uppercase text-[color:var(--color-text-muted)]">
                <th className="py-1 pr-4 font-bold">{t("detail.field")}</th>
                <th className="py-1 pr-4 font-bold">{t("detail.before")}</th>
                <th className="py-1 font-bold">{t("detail.after")}</th>
              </tr>
            </thead>
            <tbody>
              {diffKeys.map((key) => (
                <tr key={key} className="border-t border-[color:var(--color-border-soft)]">
                  <td className="py-1 pr-4 font-semibold">{key}</td>
                  <td className="py-1 pr-4 text-red-500 line-through opacity-70">
                    {renderValue(log.old_value?.[key])}
                  </td>
                  <td className="py-1 font-medium text-green-600 dark:text-green-400">
                    {renderValue(log.new_value?.[key])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <span className="text-[color:var(--color-text-muted)]">{t("detail.noChanges")}</span>
      )}

      {log.metadata ? (
        <div>
          <span className="text-xs font-bold uppercase text-[color:var(--color-text-muted)]">
            {t("detail.metadata")}
          </span>
          <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-black/5 p-2 text-xs dark:bg-white/5">
            {JSON.stringify(log.metadata, null, 2)}
          </pre>
        </div>
      ) : null}

      {log.trace_id ? (
        <span className="text-xs text-[color:var(--color-text-muted)]">
          {t("detail.traceId")}: <code>{log.trace_id}</code>
        </span>
      ) : null}
    </div>
  );
};

export default memo(ActivityLogDetail);
