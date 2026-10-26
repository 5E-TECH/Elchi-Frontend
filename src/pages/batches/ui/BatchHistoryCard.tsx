// dizayn-v2: superadmin-batches-detail, admin-batches-detail, manager-batches-detail-send, manager-batches-detail-readonly, manager-returns-batch-detail
import { CircleX, History, Inbox, Plus, Truck, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { BatchDirection, BatchHistoryItem } from "../../../entities/batch";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Badge, Card, EmptyState, ErrorState, SkeletonLines } from "../../../shared/ui/primitives";
import { knownText, readBatchHistoryKind, type BatchHistoryKind } from "../model/batchView";

const KIND_ICON: Record<BatchHistoryKind, LucideIcon> = {
  created: Plus,
  sent: Truck,
  received: Inbox,
  cancelled: CircleX,
};

type Props = {
  /** Ko'rsatish tartibida (maket: eng yangisi tepada). */
  items: readonly BatchHistoryItem[];
  direction: BatchDirection;
  /** Qabul qiluvchi filial nomi («Paket Toshkent HQ'ga jo'natildi»); noma'lum bo'lsa — nomsiz matn. */
  targetName: string | null;
  /** `GET transfer-batches/:id/history` yuklanmoqda — karta ichida skelet (sahifa kutmaydi). */
  loading?: boolean;
  /** Tarix so'rovi xatosi — karta ichida `ErrorState` + «Qayta urinish». */
  error?: unknown;
  onRetry?: () => void;
  retrying?: boolean;
};

/**
 * «TARIX» kartasi (maket `*-batches-detail*`): vaqt chizig'i — ikonka (doira) va ulovchi chiziq, harakat, bajargan
 * xodim va vaqt (o'ngda). Backend harakati `CREATED | SENT | RECEIVED | CANCELLED` — tarjima qilingan matnga, boshqasi
 * — backend `action_label` (bo'lmasa xom `action`). Bo'sh bo'lsa — «Tarix hozircha mavjud emas»; yuklanish — skelet;
 * xato — «Qayta urinish» (3HKvAyhm: ma'lumot `GET transfer-batches/:id/history` dan).
 */
const BatchHistoryCard = ({ items, direction, targetName, loading = false, error, onRetry, retrying }: Props) => {
  const { t, i18n } = useTranslation("batches");
  const language = i18n.resolvedLanguage ?? i18n.language;

  const actionText = (item: BatchHistoryItem, kind: BatchHistoryKind | null) => {
    if (kind === "created") return t(direction === "return" ? "detail.historyAction.createdReturn" : "detail.historyAction.created");
    if (kind === "sent") return targetName ? t("detail.historyAction.sentTo", { to: targetName }) : t("detail.historyAction.sent");
    if (kind === "received") {
      return targetName ? t("detail.historyAction.receivedAt", { to: targetName }) : t("detail.historyAction.received");
    }
    if (kind === "cancelled") return t("detail.historyAction.cancelled");
    return knownText(item.label) ?? knownText(item.action) ?? "—";
  };

  const failed = !loading && error != null;
  const hasItems = !loading && !failed && items.length > 0;

  return (
    <Card
      title={t("detail.history")}
      titleAddon={
        hasItems ? (
          <Badge>{t("detail.historyCount", { value: formatNumberLocalized(items.length, { language }) })}</Badge>
        ) : null
      }
      padding={hasItems || loading ? "lg" : "none"}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <>
          <span role="status" className="sr-only">
            {t("detail.historyLoading")}
          </span>
          <SkeletonLines lines={3} />
        </>
      ) : failed ? (
        <ErrorState error={error} title={t("detail.historyError")} onRetry={onRetry} retrying={retrying} />
      ) : hasItems ? (
        <ol aria-label={t("detail.historyLabel")} className="flex flex-col">
          {items.map((item, index) => {
            const kind = readBatchHistoryKind(item.action);
            const Icon = kind ? KIND_ICON[kind] : History;
            const actor = knownText(item.actor);
            const isLast = index === items.length - 1;
            return (
              <li key={item.id} className="flex gap-3">
                <div className="flex w-8 flex-none flex-col items-center">
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-sunken text-text-muted">
                    <Icon aria-hidden="true" size={16} strokeWidth={2} />
                  </span>
                  {isLast ? null : <span aria-hidden="true" className="my-1 w-0.5 flex-1 rounded-full bg-border" />}
                </div>
                <div className={cx("flex min-w-0 flex-1 flex-wrap justify-between gap-x-4 gap-y-1 pt-1", isLast ? "pb-0" : "pb-5")}>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="text-sm font-semibold text-text">{actionText(item, kind)}</p>
                    {actor ? <p className="text-[13px] text-text-muted">{actor}</p> : null}
                  </div>
                  <span className="whitespace-nowrap text-[13px] text-text-muted">
                    {formatDateTimeLocalized(item.created_at, { language })}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState icon={History} title={t("detail.historyEmpty")} description={t("detail.historyEmptyHint")} />
      )}
    </Card>
  );
};

export default BatchHistoryCard;
