// dizayn-v2: superadmin-balance-history-detail-dialog, admin-balance-history-detail-dialog
import { memo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Receipt } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized, type DateInput } from "../../../shared/lib/formatDateTime";
import {
  CURRENCY_LABEL,
  formatMoneyLocalized,
  formatSignedMoneyLocalized,
  resolveMoneyLanguage,
} from "../../../shared/lib/formatMoney";
import { Badge, Button, Dialog, TONE_FG } from "../../../shared/ui/primitives";
import { orderLink, toSourceTypeLabel, type HistoryRow } from "../lib/historyRow";

/**
 * Daftar qatorining TO'LIQ tafsiloti (4WeT0Tv5), dizayn v2 (maket `superadmin-balance-history-detail-dialog`):
 * sarlavha «{manba} #{id}», «Qo'lda yozuv» / «Avtomatik»; katta ishorali o'zgarish + «Kirim» / «Chiqim»;
 * sana, oldingi/keyingi balans, kim kiritgan, buyurtma (havola yoki «Bog'lanmagan»); to'liq izoh.
 * Ma'lumot jadval qatoridan — qo'shimcha so'rov yo'q.
 */
const FinancialHistoryDetail = ({ row: openRow, onClose }: { row: HistoryRow | null; onClose: () => void }) => {
  const { t, i18n } = useTranslation("payments");
  // Yopilish harakati paytida (row → null) oxirgi qator ko'rinib turadi — oyna bo'sh holda yopilmaydi.
  const [lastRow, setLastRow] = useState(openRow);
  if (openRow && openRow !== lastRow) setLastRow(openRow);
  const row = openRow ?? lastRow;
  const language = i18n.resolvedLanguage ?? i18n.language;
  const money = (value: number) => formatMoneyLocalized(value, { language });

  const change = row?.changeAmount ?? 0;
  const isExpense = change < 0;
  const signedNumber = formatSignedMoneyLocalized(change, { language, withCurrency: false });

  return (
    <Dialog
      open={Boolean(openRow)}
      onClose={onClose}
      size="md"
      icon={Receipt}
      title={
        row ? (
          <>
            {toSourceTypeLabel(row.sourceType, t)}{" "}
            <span className="font-semibold text-text-subtle">#{row.id}</span>
          </>
        ) : null
      }
      description={row ? (row.automatic ? t("v2Balance.detail.automatic") : t("v2Balance.detail.manual")) : null}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t("v2Balance.detail.close")}
        </Button>
      }
    >
      {row ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-sunken p-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs font-semibold uppercase tracking-[.05em] text-text-muted">
                {t("v2Balance.detail.change")}
              </span>
              <span
                className={cx(
                  "whitespace-nowrap text-2xl leading-8 font-bold",
                  isExpense ? TONE_FG.danger : change > 0 ? TONE_FG.success : "text-text",
                )}
              >
                {signedNumber}
                <span className="ml-1 text-sm font-semibold text-text-muted">
                  {CURRENCY_LABEL[resolveMoneyLanguage(language)]}
                </span>
              </span>
            </div>
            <Badge icon={isExpense ? ArrowDownLeft : ArrowUpRight}>
              {isExpense ? t("v2Balance.detail.expense") : t("v2Balance.detail.income")}
            </Badge>
          </div>

          <dl className="m-0 grid grid-cols-[minmax(120px,40%)_1fr] gap-x-4 gap-y-2.5 text-sm">
            <dt className="text-text-muted">{t("v2Balance.detail.date")}</dt>
            <dd className="m-0 min-w-0 font-semibold text-text">{formatDateTimeLocalized(row.date as DateInput, { language })}</dd>
            <dt className="text-text-muted">{t("v2Balance.detail.previous")}</dt>
            <dd className="m-0 min-w-0 whitespace-nowrap font-semibold text-text">{money(row.previousBalance)}</dd>
            <dt className="text-text-muted">{t("v2Balance.detail.next")}</dt>
            <dd className="m-0 min-w-0 whitespace-nowrap font-semibold text-text">{money(row.nextBalance)}</dd>
            <dt className="text-text-muted">{t("v2Balance.detail.actor")}</dt>
            <dd className="m-0 min-w-0 break-words font-semibold text-text">
              {row.automatic ? t("v2Balance.detail.automatic") : row.actorName || "—"}
            </dd>
            <dt className="text-text-muted">{t("v2Balance.detail.order")}</dt>
            <dd className="m-0 min-w-0 font-semibold text-text">
              {row.orderId ? (
                <Link
                  to={orderLink(row.orderId)}
                  onClick={onClose}
                  className="text-action-fg underline-offset-2 hover:underline"
                >
                  {t("v2Balance.detail.orderLink", { id: row.orderId })}
                </Link>
              ) : (
                <span className="font-normal text-text-subtle">{t("v2Balance.detail.notLinked")}</span>
              )}
            </dd>
          </dl>

          {row.comment ? (
            <div className="flex flex-col gap-1.5 border-t border-border pt-4">
              <span className="text-[13px] font-semibold text-text">{t("v2Balance.detail.comment")}</span>
              <p className="m-0 whitespace-pre-wrap break-words text-sm text-text">{row.comment}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </Dialog>
  );
};

export default memo(FinancialHistoryDetail);
