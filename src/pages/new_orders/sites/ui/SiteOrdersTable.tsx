// dizayn-v2: (maket yo'q) superadmin-integrations-legacy-source-detail
import { memo, useMemo } from "react";
import { CircleAlert, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { formatPhone } from "../../../../shared/lib/formatPhone";
import { DataTable, IconButton, type DataTableColumn } from "../../../../shared/ui/primitives";
import type { SiteOrderPreview } from "../model/siteOrder";

/** Ko'rsatiladigan mahsulotlar soni — qolgani «+N» (BeePost: 4 ta; jadval ustunida 2 tasi sig'adi). */
const VISIBLE_ITEMS = 2;

type Props = {
  rows: readonly SiteOrderPreview[];
  onRemove: (row: SiteOrderPreview) => void;
  /** Qabul ketayotganda — olib tashlash o'chiq. */
  busy?: boolean;
};

/** Qator nomi — mijoz ismi, bo'lmasa QR (xabar va tugma nomlarida). */
export const siteOrderLabel = (row: SiteOrderPreview) => row.name || row.qr;

const RowError = ({ text }: { text: string }) => (
  <span className="flex items-start gap-1.5 text-[13px] font-semibold text-danger-fg">
    <CircleAlert size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
    <span className="min-w-0 [overflow-wrap:anywhere]">{text}</span>
  </span>
);

/**
 * SKANERLANGAN BUYURTMALAR — saytdan olingan, hali Elchi'da yaratilmagan buyurtmalar.
 *
 * Maket yo'q — eng yaqini `superadmin-integrations-legacy-source-detail` («Skanerlangan buyurtmalar» kartasi) va
 * jadval ritmi `superadmin-neworders-incoming-scan` dan. Ustunlar BeePost kartasidagi ma'lumot: QR · mijoz (ism,
 * telefon) · manzil · mahsulotlar · summa · «olib tashlash». Qabulda o'tmagan qatorda sababi qizil matn bilan.
 * Telefonda — kartalar.
 */
const SiteOrdersTable = ({ rows, onRemove, busy }: Props) => {
  const { t, i18n } = useTranslation("newOrders");
  const language = i18n.resolvedLanguage ?? i18n.language;

  const itemsText = (row: SiteOrderPreview) => {
    if (!row.items.length) return null;
    const shown = row.items
      .slice(0, VISIBLE_ITEMS)
      .map((item) => t("sites.itemLine", { name: item.name, value: formatNumberLocalized(item.quantity, { language }) }));
    const rest = row.items.length - VISIBLE_ITEMS;
    return rest > 0 ? [...shown, t("sites.moreItems", { value: formatNumberLocalized(rest, { language }) })].join(", ") : shown.join(", ");
  };

  const amount = (row: SiteOrderPreview) =>
    row.amount === null ? <span className="text-text-muted">—</span> : formatMoneyLocalized(row.amount, { language });

  const removeButton = (row: SiteOrderPreview, className?: string) => (
    <IconButton
      icon={Trash2}
      label={t("sites.remove", { order: siteOrderLabel(row) })}
      disabled={busy}
      className={className}
      onClick={(event) => {
        event.stopPropagation();
        onRemove(row);
      }}
    />
  );

  const columns = useMemo<DataTableColumn<SiteOrderPreview>[]>(
    () => [
      {
        id: "qr",
        header: t("sites.colQr"),
        className: "w-[18%]",
        cell: (row) => (
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold tabular-nums text-text [overflow-wrap:anywhere]">{row.qr}</span>
            {row.externalId ? (
              <span className="text-[13px] text-text-muted [overflow-wrap:anywhere]">
                {t("sites.siteId", { id: row.externalId })}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: "customer",
        header: t("sites.colCustomer"),
        className: "w-[24%]",
        cell: (row) => (
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className={row.name ? "font-semibold text-text" : "text-text-muted"}>
              {row.name || t("sites.unknownCustomer")}
            </span>
            {row.phone ? <span className="whitespace-nowrap text-[13px] text-text-muted">{formatPhone(row.phone)}</span> : null}
            {row.error ? <RowError text={row.error} /> : null}
          </span>
        ),
      },
      {
        id: "address",
        header: t("sites.colAddress"),
        className: "w-[22%]",
        cell: (row) =>
          row.address ? (
            <span className="[overflow-wrap:anywhere]">{row.address}</span>
          ) : (
            <span className="text-text-muted">—</span>
          ),
      },
      {
        id: "items",
        header: t("sites.colItems"),
        className: "w-[20%]",
        cell: (row) => {
          const text = itemsText(row);
          return text ? (
            <span className="text-text-muted [overflow-wrap:anywhere]">{text}</span>
          ) : (
            <span className="text-text-muted">—</span>
          );
        },
      },
      {
        id: "amount",
        header: t("sites.colAmount"),
        align: "end",
        className: "w-[12%]",
        cellClassName: "whitespace-nowrap font-semibold",
        cell: amount,
      },
      {
        id: "actions",
        header: <span className="sr-only">{t("sites.colActions")}</span>,
        className: "w-14",
        cellClassName: "text-right",
        cell: (row) => removeButton(row),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ustunlar faqat til va band holatiga bog'liq
    [busy, language, t],
  );

  const renderCard = (row: SiteOrderPreview) => {
    const text = itemsText(row);
    return (
      <div className="flex min-w-0 items-start gap-3 px-4 py-3 text-sm text-text">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 justify-between gap-2">
            <span className={row.name ? "min-w-0 font-semibold [overflow-wrap:anywhere]" : "min-w-0 text-text-muted"}>
              {row.name || t("sites.unknownCustomer")}
            </span>
            <span className="whitespace-nowrap font-semibold">{amount(row)}</span>
          </span>
          {row.phone ? <span className="text-[13px] text-text-muted">{formatPhone(row.phone)}</span> : null}
          {row.address ? <span className="text-[13px] text-text-muted [overflow-wrap:anywhere]">{row.address}</span> : null}
          {text ? <span className="text-[13px] text-text-muted [overflow-wrap:anywhere]">{text}</span> : null}
          <span className="text-[13px] text-text-subtle [overflow-wrap:anywhere]">
            {[row.qr, row.externalId ? t("sites.siteId", { id: row.externalId }) : null].filter(Boolean).join(" · ")}
          </span>
          {row.error ? <RowError text={row.error} /> : null}
        </span>
        {removeButton(row, "-mr-2 -mt-1 shrink-0")}
      </div>
    );
  };

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowKey={(row) => row.key}
      label={t("sites.listTitle")}
      rowClassName={(row) => (row.error ? "bg-danger-soft" : null)}
      renderCard={renderCard}
    />
  );
};

export default memo(SiteOrdersTable);
