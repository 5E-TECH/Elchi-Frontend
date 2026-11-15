// dizayn-v2: (maket yo'q) superadmin-neworders-cancelled-handover-done
import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { Undo2 } from "lucide-react";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { Badge, Button, Card, DataTable, type DataTableColumn } from "../../../../shared/ui/primitives";
import { readOrderDistrict, type MarketOrder } from "../../components/marketOrders/marketOrdersModel";

/**
 * «SKANERLANGAN (N)» — skanerlangan, hali jo'natilmagan bekor qilingan buyurtmalar (ega qarori 2026-11-15,
 * BeePost «Marketga topshirish» naqshi). Skanerlangan qator «Bekor qilingan buyurtmalarni tayyorlash» ro'yxatidan
 * CHIQADI — ro'yxat uzunligi «yana nechta qoldi» degan javob bo'ladi va xodim «qaysinisini o'qitdim?» deb butun
 * ro'yxatni ko'zdan kechirmaydi. Bu karta jo'natishdan oldin tekshirish uchun: xato skanerlangani «Ro'yxatga
 * qaytarish» bilan bittalab qaytariladi. Yangi skan tepada. Qo'lda tasdiqlangan (QR buzilgan) qatorlar bu yerga
 * tushmaydi — ular sababi bilan ro'yxatda qoladi.
 *
 * Maket yo'q — eng yaqini `superadmin-neworders-cancelled-handover-done` («Topshirildi (N)», `HandedOverCard`):
 * Buyurtma · Mijoz · Summa + amal; telefonda kartalar. Skanni qaytarish amali — `Undo2` (kamera ro'yxatidagi
 * «Bekor qilish» va `manager-new-orders-incoming-scan-undo` dagi «Olib tashlash» bilan bir xil; `RotateCcw` —
 * reyestrda «marketga qaytarish», ya'ni bu sahifaning teskari amali).
 */
export const ScannedOrdersCard = ({
  rows,
  onUndo,
  disabled = false,
}: {
  rows: readonly MarketOrder[];
  onUndo: (orderId: string) => void;
  /** Jo'natish ketayotganda qaytarish o'chiq. */
  disabled?: boolean;
}) => {
  const { t, i18n } = useTranslation("newOrders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const money = (value: unknown) => formatMoneyLocalized(value, { language });
  const total = rows.reduce((sum, row) => sum + (Number(row.total_price) || 0), 0);

  const undoButton = (row: MarketOrder, className?: string) => (
    <Button
      variant="secondary"
      size="sm"
      leftIcon={Undo2}
      disabled={disabled}
      aria-label={t("cancelled.scanned.undoAria", { id: row.id })}
      onClick={() => onUndo(String(row.id))}
      className={className ?? "whitespace-nowrap"}
    >
      {t("cancelled.scanned.undo")}
    </Button>
  );

  // Qatorlar kam (bir sessiyada skanerlanganlar) — ustunlar har chizishda quriladi.
  const columns: DataTableColumn<MarketOrder>[] = [
    {
      id: "order",
      header: t("cancelled.done.columns.order"),
      cell: (row) => (
        <Link
          to={`/orders/edit/${row.id}`}
          className="whitespace-nowrap font-semibold text-text hover:text-action-fg hover:underline"
        >
          №{row.id}
        </Link>
      ),
    },
    {
      id: "customer",
      header: t("cancelled.done.columns.customer"),
      cell: (row) => (
        <>
          <div className="whitespace-nowrap font-semibold text-text">{row.customer?.name || "—"}</div>
          {readOrderDistrict(row) ? (
            <div className="text-[13px] text-text-muted">{readOrderDistrict(row)}</div>
          ) : null}
        </>
      ),
    },
    {
      id: "amount",
      header: t("cancelled.done.columns.amount"),
      align: "end",
      cell: (row) => <span className="whitespace-nowrap font-semibold text-text">{money(row.total_price)}</span>,
    },
    {
      id: "undo",
      header: <span className="sr-only">{t("cancelled.scanned.undoColumn")}</span>,
      align: "end",
      cell: (row) => undoButton(row),
    },
  ];

  // Telefon: ism va summa bir qatorda, ostida № · tuman, amal — butun kenglikda (yagona nishon, 44 px).
  const renderCard = (row: MarketOrder) => (
    <div className="flex min-w-0 flex-col gap-2.5 px-4 py-3 text-text">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="break-words font-semibold">{row.customer?.name || "—"}</span>
          {/* № — oddiy matn: kichik qatordagi havola telefonda 44 px nishon bo'lmaydi (tafsilot — desktop jadvalida). */}
          <span className="text-[13px] text-text-muted">
            <span className="font-semibold text-text">№{row.id}</span>
            {readOrderDistrict(row) ? ` · ${readOrderDistrict(row)}` : null}
          </span>
        </div>
        <span className="shrink-0 whitespace-nowrap font-semibold">{money(row.total_price)}</span>
      </div>
      {undoButton(row, "w-full")}
    </div>
  );

  const count = formatNumberLocalized(rows.length, { language });
  const totalLine = (
    <Trans
      t={t}
      i18nKey="cancelled.done.total"
      values={{ sum: money(total) }}
      components={{ strong: <strong className="font-semibold text-text" /> }}
    />
  );

  return (
    <Card
      as="section"
      padding="none"
      title={t("cancelled.scanned.title")}
      titleAddon={<Badge>{t("cancelled.done.count", { count: rows.length, value: count })}</Badge>}
      description={
        <>
          {t("cancelled.scanned.hint")}
          <span className="mt-1 block md:hidden" data-testid="scanned-total-phone">
            {totalLine}
          </span>
        </>
      }
      actions={<p className="m-0 whitespace-nowrap text-[13px] text-text-muted max-md:hidden">{totalLine}</p>}
      data-testid="scanned-card"
    >
      <DataTable
        rows={[...rows]}
        columns={columns}
        getRowKey={(row) => String(row.id)}
        label={t("cancelled.scanned.label")}
        renderCard={renderCard}
        className="border-t border-border"
      />
    </Card>
  );
};
