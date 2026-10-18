// dizayn-v2: courier-scan-package-detail, courier-scan-post-detail
import { Package } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OrderStatusBadge } from "../../../entities/order";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { Badge, Card, DataTable, EmptyState, type DataTableColumn } from "../../../shared/ui/primitives";
import type { ScanListOrderRow } from "../model/scanBatchView";

type ScanOrdersCardProps = {
  title: string;
  rows: ScanListOrderRow[];
  /** Badge'dagi son (paket javobidagi `order_count`; ro'yxat qisqa kelsa ham haqiqiy son). */
  count: number;
  emptyText: string;
};

const orderNo = (id: string) => (id.startsWith("#") ? id : `№${id}`);

/**
 * «Paket ichidagi buyurtmalar» / «Pochtadagi buyurtmalar» — `DataTable` (Buyurtma · Mijoz + telefon ·
 * Summa · Holat), telefonda kartalar (ism + summa / «№id · telefon» + holat). Mijoz yoki holat javobda
 * bo'lmasa — «—» / badge'siz.
 */
export const ScanOrdersCard = ({ title, rows, count, emptyText }: ScanOrdersCardProps) => {
  const { t, i18n } = useTranslation("scan");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const money = (value: number | null) => (value === null ? "—" : formatMoneyLocalized(value, { language }));

  const columns: DataTableColumn<ScanListOrderRow>[] = [
    {
      id: "order",
      header: t("table.order"),
      cell: (row) => <span className="whitespace-nowrap font-semibold">{orderNo(row.id)}</span>,
    },
    {
      id: "customer",
      header: t("table.customer"),
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <span className="whitespace-nowrap font-semibold">{row.customer ?? "—"}</span>
          {row.phone ? <span className="text-[13px] text-text-muted">{formatPhone(row.phone)}</span> : null}
        </div>
      ),
    },
    {
      id: "sum",
      header: t("table.sum"),
      align: "end",
      cell: (row) => <span className="font-semibold">{money(row.amount)}</span>,
    },
    {
      id: "status",
      header: t("table.status"),
      cell: (row) => (row.status ? <OrderStatusBadge status={row.status} /> : <span className="text-text-muted">—</span>),
    },
  ];

  return (
    <Card
      padding="none"
      title={title}
      titleAddon={<Badge>{t("quantity", { count, value: formatNumberLocalized(count, { language }) })}</Badge>}
    >
      {rows.length === 0 ? (
        <EmptyState icon={Package} title={emptyText} />
      ) : (
        <DataTable
          label={title}
          rows={rows}
          columns={columns}
          getRowKey={(row, index) => `${row.id}-${index}`}
          cardsLabel={title}
          renderCard={(row) => {
            // Mijoz ismi yo'q bo'lsa raqam sarlavhada — ikkinchi qatorda takrorlanmaydi.
            const sub = [row.customer ? orderNo(row.id) : null, row.phone ? formatPhone(row.phone) : null]
              .filter(Boolean)
              .join(" · ");
            return (
              <div className="flex min-w-0 flex-col gap-1 px-4 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate font-semibold text-text">{row.customer ?? orderNo(row.id)}</span>
                  <span className="whitespace-nowrap font-semibold text-text">{money(row.amount)}</span>
                </div>
                {sub || row.status ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[13px] text-text-muted">{sub}</span>
                    {row.status ? <OrderStatusBadge status={row.status} /> : null}
                  </div>
                ) : null}
              </div>
            );
          }}
        />
      )}
    </Card>
  );
};
