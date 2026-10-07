import { useState } from "react";
import { Alert, Button, Collapse, Form, Input, Tag } from "antd";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStatusCatalog, type StatusCatalogEntry } from "../../entities/integrations/statusCatalog";
import type { ConnectionField } from "./connections";
import { useStatusLabel } from "./statusLabel";
import {
  catalogFor,
  extraKeys,
  extraText,
  matchedCount,
  rowText,
  setExtra,
  setRow,
  type StatusMapKind,
  type StatusMapValue,
} from "./statusMap";

/**
 * STATUS XARITASI MUHARRIRI (JnHK6bgV) — erkin kalit→qiymat o'rniga
 * jadval: har qatorda kanonik kod + uning MA'NOSI + hamkor qiymati.
 *
 * Operator endi bo'sh katakka nima yozishni taxmin qilmaydi. Hamkor
 * qiymati ERKIN matn (raqam "7", kirill "доставлено", kod "ST-07") —
 * validatsiya majburlanmaydi. Katalogda yo'q eski yozuvlar o'chib ketmaydi:
 * pastdagi "Qo'shimcha" bo'limida turadi.
 */

const ACTION_LABEL_KEY = { sell: "smActionSell", cancel: "smActionCancel", return: "smActionReturn" } as const;

const StatusMapField = ({
  field,
  kind,
  value,
  disabled,
  onChange,
}: {
  field: ConnectionField;
  kind: StatusMapKind;
  value: unknown;
  disabled?: boolean;
  onChange: (next: StatusMapValue) => void;
}) => {
  const { t } = useTranslation("integrations");
  const statusLabel = useStatusLabel();
  const catalogQuery = useStatusCatalog();
  const catalog = catalogQuery.data;

  if (!catalog) {
    return (
      <Form.Item label={t(field.labelKey)} className="md:col-span-2">
        {catalogQuery.isLoading ? (
          <span className="text-sm text-gray-400">{t("smLoading")}</span>
        ) : (
          <Alert type="warning" showIcon message={t("smCatalogError")} />
        )}
      </Form.Item>
    );
  }

  const entries = catalogFor(kind, catalog);
  const matched = matchedCount(kind, value, entries);
  const extras = extraKeys(kind, value, entries);

  const labelOf = (entry: StatusCatalogEntry) =>
    kind === "payment" ? t(`smPayment_${entry.key}`) : statusLabel(entry.code);
  const meaningOf = (entry: StatusCatalogEntry) =>
    t(`smMeaning_${entry.key}`, { defaultValue: entry.meaning_uz });

  return (
    <Form.Item
      className="md:col-span-2"
      label={
        <span className="flex flex-wrap items-center gap-2">
          {t(field.labelKey)}
          <Tag color={matched === entries.length ? "green" : "gold"} data-testid="status-map-matched">
            {t("smMatched", { matched, total: entries.length })}
          </Tag>
        </span>
      }
      extra={field.hintKey ? t(field.hintKey) : undefined}
    >
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700" role="table">
        <div
          role="row"
          className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] gap-3 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-800/60 dark:text-gray-400 md:grid"
        >
          <span role="columnheader">{t("smColOurs")}</span>
          <span role="columnheader">{t("smColMeaning")}</span>
          <span role="columnheader">{t(kind === "outbound" ? "smColTheirs" : "smColTheirsMany")}</span>
        </div>
        {entries.map((entry) => {
          const action = kind === "inbound" ? catalog.inbound_default_action[entry.code] : undefined;
          const inputId = `${field.key}-${entry.key}`;
          return (
            <div
              key={entry.code}
              role="row"
              data-testid={`status-map-row-${entry.key}`}
              className="grid grid-cols-1 gap-1.5 border-t border-gray-100 px-3 py-2.5 first:border-t-0 dark:border-gray-800 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] md:items-center md:gap-3"
            >
              <label role="cell" htmlFor={inputId} className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold">{labelOf(entry)}</span>
                <code className="truncate text-xs text-gray-400">{entry.code}</code>
              </label>
              <span role="cell" className="text-sm text-gray-600 dark:text-gray-300">
                {meaningOf(entry)}
                {action && (
                  <Tag className="ml-2" color="purple">
                    {t(ACTION_LABEL_KEY[action])}
                  </Tag>
                )}
              </span>
              <span role="cell">
                <Input
                  id={inputId}
                  value={rowText(kind, value, entry.code)}
                  disabled={disabled}
                  placeholder={t(
                    kind === "outbound" ? "smPlaceholderOne" : kind === "inbound" ? "smPlaceholderInbound" : "smPlaceholderMany",
                  )}
                  onChange={(e) => onChange(setRow(kind, value, entry.code, e.target.value, action))}
                />
              </span>
            </div>
          );
        })}
      </div>

      <ExtrasSection kind={kind} value={value} extras={extras} disabled={disabled} onChange={onChange} />
    </Form.Item>
  );
};

/**
 * "Qo'shimcha / nostandart qiymatlar" — erkin muharrir, asosiy jadval
 * ostida YIG'ILGAN. Katalogda yo'q eski yozuvlar shu yerda ko'rinadi.
 */
const ExtrasSection = ({
  kind,
  value,
  extras,
  disabled,
  onChange,
}: {
  kind: StatusMapKind;
  value: unknown;
  extras: string[];
  disabled?: boolean;
  onChange: (next: StatusMapValue) => void;
}) => {
  const { t } = useTranslation("integrations");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const add = () => {
    if (!newKey.trim() || !newValue.trim()) return;
    onChange(setExtra(kind, value, newKey.trim(), newValue));
    setNewKey("");
    setNewValue("");
  };

  return (
    <Collapse
      className="mt-3"
      size="small"
      items={[
        {
          key: "extras",
          label: t("smExtras", { count: extras.length }),
          children: (
            <div className="flex flex-col gap-2">
              <p className="m-0 text-xs text-gray-500">{t(kind === "inbound" ? "smExtrasHintInbound" : "smExtrasHint")}</p>
              {extras.map((key) => (
                <div key={key} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
                  <code className="truncate rounded bg-gray-50 px-2 py-1 text-xs dark:bg-gray-800">{key}</code>
                  <Input
                    aria-label={key}
                    value={extraText(kind, value, key)}
                    disabled={disabled}
                    onChange={(e) => onChange(setExtra(kind, value, key, e.target.value))}
                  />
                  <Button
                    aria-label={t("smRemove", { key })}
                    icon={<Trash2 className="h-4 w-4" />}
                    disabled={disabled}
                    onClick={() => onChange(setExtra(kind, value, key, ""))}
                  />
                </div>
              ))}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <Input
                  value={newKey}
                  disabled={disabled}
                  placeholder={t(kind === "inbound" ? "smNewKeyInbound" : "smNewKey")}
                  onChange={(e) => setNewKey(e.target.value)}
                />
                <Input
                  value={newValue}
                  disabled={disabled}
                  placeholder={t(kind === "inbound" ? "smNewValueInbound" : "smNewValue")}
                  onChange={(e) => setNewValue(e.target.value)}
                />
                <Button icon={<Plus className="h-4 w-4" />} disabled={disabled || !newKey.trim() || !newValue.trim()} onClick={add}>
                  {t("smAdd")}
                </Button>
              </div>
            </div>
          ),
        },
      ]}
    />
  );
};

export default StatusMapField;
