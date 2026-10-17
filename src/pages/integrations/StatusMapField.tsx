// dizayn-v2: superadmin-integrations-marketplace-console, superadmin-integrations-panel-settings
import { useId, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OrderStatusBadge } from "../../entities/order";
import { useStatusCatalog, type StatusCatalogEntry } from "../../entities/integrations/statusCatalog";
import { Badge, Button, IconButton, SkeletonLines, TextInput } from "../../shared/ui/primitives";
import type { ConnectionField } from "./connections";
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
import { InlineAlert } from "./ui";

/**
 * STATUS XARITASI MUHARRIRI (JnHK6bgV) — erkin kalit→qiymat o'rniga jadval: har qatorda kanonik holat
 * (badge + kod) + uning MA'NOSI + hamkor qiymati (maket `*-marketplace-console` «Chiquvchi holat xaritasi»).
 *
 * Hamkor qiymati ERKIN matn (raqam «7», kirill «доставлено», kod «ST-07») — validatsiya majburlanmaydi.
 * Katalogda yo'q eski yozuvlar o'chib ketmaydi: pastdagi «Qo'shimcha» bo'limida turadi.
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
  const catalogQuery = useStatusCatalog();
  const catalog = catalogQuery.data;
  const titleId = useId();

  const head = (matched?: { matched: number; total: number }) => (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span id={titleId} className="text-sm font-semibold text-text">
          {t(field.labelKey)}
        </span>
        {matched ? (
          <Badge
            tone={matched.matched === matched.total ? "success" : "warning"}
            data-testid="status-map-matched"
            aria-label={t("console.smMatchedAria", matched)}
          >
            {t("smMatched", matched)}
          </Badge>
        ) : null}
      </div>
      {field.hintKey ? <p className="text-[13px] leading-[18px] text-text-muted">{t(field.hintKey)}</p> : null}
    </div>
  );

  if (!catalog) {
    return (
      <div className="flex min-w-0 flex-col gap-3">
        {head()}
        {catalogQuery.isLoading ? (
          <SkeletonLines lines={3} role="status" aria-label={t("smLoading")} />
        ) : (
          <InlineAlert tone="warning">{t("smCatalogError")}</InlineAlert>
        )}
      </div>
    );
  }

  const entries = catalogFor(kind, catalog);
  const matched = matchedCount(kind, value, entries);
  const extras = extraKeys(kind, value, entries);

  const meaningOf = (entry: StatusCatalogEntry) => t(`smMeaning_${entry.key}`, { defaultValue: entry.meaning_uz });

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {head({ matched, total: entries.length })}
      <div className="min-w-0 overflow-hidden rounded-xl border border-border" role="table" aria-labelledby={titleId}>
        <div
          role="row"
          className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] gap-3 bg-sunken px-4 py-2.5 text-xs font-semibold uppercase tracking-[.04em] text-text-muted md:grid"
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
              className="grid grid-cols-1 gap-1.5 border-t border-border px-4 py-3 first:border-t-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] md:items-center md:gap-3"
            >
              <label role="cell" htmlFor={inputId} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                {kind === "payment" ? (
                  <span className="text-sm font-semibold text-text">{t(`smPayment_${entry.key}`)}</span>
                ) : (
                  <OrderStatusBadge status={entry.code} />
                )}
                <code className="truncate text-xs text-text-subtle">{entry.code}</code>
              </label>
              <span role="cell" className="flex min-w-0 flex-wrap items-center gap-2 text-[13px] text-text-muted">
                {meaningOf(entry)}
                {action ? <Badge tone="info">{t(ACTION_LABEL_KEY[action])}</Badge> : null}
              </span>
              <span role="cell" className="min-w-0">
                <TextInput
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
    </div>
  );
};

/**
 * «Qo'shimcha / nostandart qiymatlar» — erkin muharrir, asosiy jadval ostida YIG'ILGAN (maket: ghost
 * tugma). Katalogda yo'q eski yozuvlar shu yerda ko'rinadi.
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
  const [open, setOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const panelId = useId();

  const add = () => {
    if (!newKey.trim() || !newValue.trim()) return;
    onChange(setExtra(kind, value, newKey.trim(), newValue));
    setNewKey("");
    setNewValue("");
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Button
        variant="ghost"
        size="sm"
        leftIcon={open ? ChevronDown : ChevronRight}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="-ml-2 self-start max-md:min-h-11"
      >
        {t("smExtras", { count: extras.length })}
      </Button>
      {open ? (
        <div id={panelId} className="flex min-w-0 flex-col gap-3 rounded-xl bg-sunken p-4">
          <p className="text-xs text-text-muted">{t(kind === "inbound" ? "smExtrasHintInbound" : "smExtrasHint")}</p>
          {extras.map((key) => (
            <div key={key} className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
              <code className="truncate rounded-md bg-surface px-2 py-1 text-xs text-text">{key}</code>
              <TextInput
                aria-label={key}
                value={extraText(kind, value, key)}
                disabled={disabled}
                onChange={(e) => onChange(setExtra(kind, value, key, e.target.value))}
              />
              <IconButton
                variant="danger-soft"
                icon={Trash2}
                label={t("smRemove", { key })}
                disabled={disabled}
                onClick={() => onChange(setExtra(kind, value, key, ""))}
              />
            </div>
          ))}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <TextInput
              aria-label={t(kind === "inbound" ? "smNewKeyInbound" : "smNewKey")}
              value={newKey}
              disabled={disabled}
              placeholder={t(kind === "inbound" ? "smNewKeyInbound" : "smNewKey")}
              onValueChange={setNewKey}
            />
            <TextInput
              aria-label={t(kind === "inbound" ? "smNewValueInbound" : "smNewValue")}
              value={newValue}
              disabled={disabled}
              placeholder={t(kind === "inbound" ? "smNewValueInbound" : "smNewValue")}
              onValueChange={setNewValue}
            />
            <Button variant="secondary" leftIcon={Plus} disabled={disabled || !newKey.trim() || !newValue.trim()} onClick={add}>
              {t("smAdd")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default StatusMapField;
