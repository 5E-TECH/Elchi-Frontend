// dizayn-v2: superadmin-payments-history-detail-dialog-corrected, superadmin-payments-history-detail-dialog-replacement, admin-payments-history-detail-dialog-corrected, manager-payments-history-detail-dialog-corrected, market-cashbox-history-detail-dialog-corrected, courier-cashbox-history-detail-corrected
import { memo, useId, type MouseEvent, type ReactNode } from "react";
import { ChevronRight, Pencil, RotateCcw } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import {
  correctionBadgeKindOf,
  type PaymentCorrection,
  type PaymentCorrectionRelated,
} from "../../../entities/payments/paymentCorrection";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatSignedMoneyLocalized } from "../../../shared/lib/formatMoney";
import { Pressable } from "../../../shared/ui/primitives";
import { correctionBadgeLabel } from "./lib/paymentCorrectionView";
import { PaymentCorrectionBadge } from "./PaymentCorrectionBadge";
import { getPaymentSourceTitle, getViewerOperationType } from "./paymentSourceType";

/**
 * «QAYTARISH VA TAHRIR» BLOKI (T6) — tarix yozuvi tafsilotida, xulosadan keyin (maketlar
 * `*-payments-history-detail-dialog-corrected`, `…-replacement`, `market-cashbox-history-detail-dialog-corrected`,
 * `courier-cashbox-history-detail-corrected`). Barcha rollarga — sabab ham (backend hech narsani yashirmaydi).
 *
 * Tuzilma: sarlavha (amal bo'yicha `Pencil` / `RotateCcw`); `dl` — Amal («Summa tahrirlandi» / «To'liq
 * qaytarildi»), Summa (tahrir: «2 400 000 so'm → 2 000 000 so'm», qaytarish: asl summa; teskari yozuvda yo'q),
 * Sana (tuzatish vaqti), Kim (`created_by_name`, bo'lmasa «—»), Sabab; «Bog'liq yozuv» — bitta qator (ega qarori):
 * sarlavha + belgi, «Asl to'lov · #id · sana» yoki «#id · sana», ishorali summa (ko'ruvchi nuqtai nazaridan),
 * `ChevronRight`. Bosilsa — o'sha oynada bog'liq yozuv tafsiloti (`onOpenRelated`). `related` kelmasa — bo'lim yo'q.
 */

const KV = "m-0 grid grid-cols-[minmax(110px,32%)_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm";
const DT = "text-text-muted";
const DD = "m-0 min-w-0 break-words font-semibold text-text";

export interface PaymentCorrectionSectionProps {
  correction: PaymentCorrection;
  /** Ko'ruvchi roli — bog'liq yozuv sarlavhasi va yo'nalishi (`getPaymentSourceTitle`, `getViewerOperationType`). */
  viewerRole?: string | null;
  /** Ko'rilayotgan yozuv kassasi (bog'liq oyoq ham shu kassada). */
  cashboxType?: string | null;
  onOpenRelated?: (related: PaymentCorrectionRelated, event: MouseEvent<HTMLButtonElement>) => void;
}

export const PaymentCorrectionSection = memo(
  ({ correction, viewerRole, cashboxType, onOpenRelated }: PaymentCorrectionSectionProps) => {
    const { t, i18n } = useTranslation("payments");
    const language = i18n.resolvedLanguage ?? i18n.language;
    const headingId = useId();
    const money = (value: number) => formatMoneyLocalized(value, { language });
    const dateTime = (value: string | null) => (value ? formatDateTimeLocalized(value, { language }) : "—");

    const isEdit = correction.action === "edit";
    const HeadingIcon = isEdit ? Pencil : RotateCcw;
    const original = correction.original_amount;
    const next = correction.new_amount;
    const amountValue: ReactNode =
      correction.role === "reversal" || original === null ? null : isEdit && next !== null ? (
        <>
          <span className="whitespace-nowrap">{money(original)}</span> →{" "}
          <span className="whitespace-nowrap">{money(next)}</span>
        </>
      ) : (
        <span className="whitespace-nowrap">{money(original)}</span>
      );

    const kvRow = (label: string, value: ReactNode, ddClassName?: string) => (
      <>
        <dt className={DT}>{label}</dt>
        <dd className={cx(DD, ddClassName)}>{value}</dd>
      </>
    );

    const related = correction.related;
    const relatedView = related
      ? (() => {
          const kind = correctionBadgeKindOf(related.role, correction.action);
          const title = getPaymentSourceTitle(related.source_type, t, { role: viewerRole, cashboxType });
          const direction = getViewerOperationType(related, viewerRole);
          const signed = formatSignedMoneyLocalized(direction === "expense" ? -related.amount : related.amount, {
            language,
          });
          const date = dateTime(related.created_at);
          const isOriginal = related.role === "original";
          // Sana bo'linmaydi (telefonda «Bugun, / 05:07» bo'lmasin) — oyna izohidagi `<date>` usuli.
          const sub = (
            <Trans
              t={t}
              i18nKey={isOriginal ? "paymentCorrection.detail.relatedOriginalSub" : "paymentCorrection.detail.relatedSub"}
              values={{ id: related.id, date }}
              components={{ date: <span className="whitespace-nowrap" /> }}
            />
          );
          const parts = [
            isOriginal ? t("paymentCorrection.detail.relatedOriginal") : "",
            title,
            correctionBadgeLabel(kind, t),
            `#${related.id}`,
            signed,
          ]
            .filter(Boolean)
            .join(", ");
          return { kind, title, direction, signed, sub, label: t("paymentCorrection.detail.relatedAria", { parts }) };
        })()
      : null;

    return (
      <section
        aria-labelledby={headingId}
        data-payment-correction-section=""
        className="flex flex-col gap-3 rounded-xl bg-sunken px-4 py-3.5"
      >
        <h3 id={headingId} className="m-0 inline-flex items-center gap-2 text-sm font-semibold text-text">
          <HeadingIcon aria-hidden="true" size={18} className="shrink-0 text-text-muted" />
          {t("paymentCorrection.detail.title")}
        </h3>
        <dl className={KV}>
          {kvRow(
            t("paymentCorrection.detail.action"),
            t(isEdit ? "paymentCorrection.detail.actionEdit" : "paymentCorrection.detail.actionReverse"),
          )}
          {amountValue ? kvRow(t("paymentCorrection.detail.amount"), amountValue) : null}
          {kvRow(t("paymentCorrection.detail.date"), dateTime(correction.created_at))}
          {kvRow(t("paymentCorrection.detail.by"), correction.created_by_name || "—")}
          {correction.reason
            ? kvRow(t("paymentCorrection.detail.reason"), correction.reason, "font-medium whitespace-pre-line")
            : null}
        </dl>

        {related && relatedView ? (
          <div className="flex flex-col gap-1 border-t border-border pt-3">
            <span className="text-xs font-semibold uppercase tracking-[.05em] text-text-muted">
              {t("paymentCorrection.detail.related")}
            </span>
            <Pressable
              aria-label={relatedView.label}
              data-related-history-id={related.id}
              onClick={(event) => onOpenRelated?.(related, event)}
              className={cx(
                "-mx-2 flex min-h-11 items-center gap-3 rounded-[10px] px-2 py-2 text-left text-sm text-text",
                "transition-[background-color] duration-150 hover:bg-row-hover motion-reduce:transition-none",
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold [overflow-wrap:anywhere]">{relatedView.title}</span>
                  <PaymentCorrectionBadge kind={relatedView.kind} />
                </span>
                <span className="text-[13px] text-text-muted">{relatedView.sub}</span>
              </span>
              <span
                className={cx(
                  "whitespace-nowrap font-semibold",
                  relatedView.direction === "income"
                    ? "text-success-fg"
                    : relatedView.direction === "expense"
                      ? "text-danger-fg"
                      : "text-text",
                )}
              >
                {relatedView.signed}
              </span>
              <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-text-muted" />
            </Pressable>
          </div>
        ) : null}
      </section>
    );
  },
);

PaymentCorrectionSection.displayName = "PaymentCorrectionSection";
