// dizayn-v2: superadmin-notifications-send-result, superadmin-notifications-sent-detail-dialog
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { CHART_FILL, SegBar } from "../../../shared/ui/charts";
import { StatusBadge } from "../../../shared/ui/primitives";
import {
  CHANNEL_ICON,
  DELIVERY_BUCKETS,
  DELIVERY_META,
  bucketCounts,
  bucketTotal,
  channelBadge,
  externalChannels,
  type BucketCounts,
} from "../model/status";
import type { ChannelStatusCounts } from "../model/types";

export type ChannelBreakdownProps = {
  /** So'ralgan kanallar (`in_app` ham bo'lishi mumkin — chizilmaydi). */
  channels: readonly string[];
  /** Kanal × holat soni (`channel_status`). */
  channelStatus: ChannelStatusCounts | null;
  /**
   * Zaxira — `channel_status` da kanal bo'lmasa (tarix yozuvi yiqilgan): `by_channel` (haqiqatan ketgan / navbatga
   * qo'yilgan son), `no_provider` va jami qatorlar.
   */
  byChannel?: Record<string, number>;
  noProvider?: readonly string[];
  dispatched?: number;
  /**
   * `result` — yuborishdan keyingi natija kartasi: navbatdagilar uchun izoh («yakuniy natija «Yuborilganlar»
   * sahifasida»); `detail` — tafsilot oynasi (holat jonli, izohsiz).
   */
  variant?: "result" | "detail";
  /** Telegram shaxsiy chatlarga (market guruhi tanlanmagan) — «N ta · shaxsiy chatga». */
  telegramDm?: boolean;
  className?: string;
};

/** `channel_status` bo'lmasa — `by_channel` dan taxminiy kesim. */
const fallbackCounts = (
  channel: string,
  { byChannel = {}, noProvider = [], dispatched = 0 }: Pick<ChannelBreakdownProps, "byChannel" | "noProvider" | "dispatched">,
): Record<string, number> => {
  if (noProvider.includes(channel)) return { no_provider: dispatched };
  const done = Math.min(Math.max(0, Number(byChannel[channel] ?? 0)), dispatched || Infinity);
  const rest = Math.max(0, dispatched - done);
  // Realtime — brokerga uzatildi (yakuniy), qolgan kanallar navbatga qo'yildi.
  return channel === "realtime" ? { emitted: done, skipped: rest } : { queued: done, skipped: rest };
};

/**
 * KANALLAR BO'YICHA (maket `*-send-result`, `*-sent-detail-dialog`): har tashqi kanal — ikonka, nom, qabul
 * qiluvchilar soni, holat belgisi, `SegBar` (yuborildi · navbatda · xato · o'tkazib yuborildi) va legenda; ostida
 * qisqa izoh. Ranglar ega S3 bo'yicha: navbatda — sariq, o'tkazib / provayder yo'q — kulrang, xato — qizil,
 * yuborildi — yashil.
 */
export const ChannelBreakdown = ({
  channels,
  channelStatus,
  byChannel,
  noProvider,
  dispatched,
  variant = "result",
  telegramDm = false,
  className,
}: ChannelBreakdownProps) => {
  const { t, i18n } = useTranslation("notifications");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const count = (value: number) => formatNumberLocalized(value, { language });

  const rows = externalChannels(channels, channelStatus).map((channel) => {
    const buckets = bucketCounts(
      channelStatus?.[channel] ?? fallbackCounts(channel, { byChannel, noProvider, dispatched }),
    );
    return { channel, buckets, total: bucketTotal(buckets) };
  });
  if (!rows.length) return null;

  const note = (channel: string, buckets: BucketCounts, total: number) => {
    if (channel === "realtime") return t("dispatch.breakdown.noteRealtime");
    if (buckets.no_provider > 0 && buckets.no_provider === total) {
      return channel === "sms"
        ? t("dispatch.breakdown.noteNoProviderSms")
        : t("dispatch.breakdown.noteNoProvider", { channel: t(`dispatch.channel.${channel}`) });
    }
    if (variant !== "result" || buckets.queued === 0) return null;
    if (buckets.queued === total) return t("dispatch.breakdown.noteAllQueued");
    return channel === "telegram" ? t("dispatch.breakdown.noteQueuedBot") : t("dispatch.breakdown.noteQueuedProvider");
  };

  return (
    <ul aria-label={t("dispatch.breakdown.label")} className={cx("m-0 flex min-w-0 list-none flex-col p-0", className)}>
      {rows.map(({ channel, buckets, total }) => {
        const Icon = CHANNEL_ICON[channel];
        const name = t(`dispatch.channel.${channel}`);
        const badge = channelBadge(buckets);
        const present = DELIVERY_BUCKETS.filter((bucket) => buckets[bucket] > 0);
        const parts = present
          .map((bucket) => `${t(DELIVERY_META[bucket].labelKey).toLocaleLowerCase(language)} ${count(buckets[bucket])}`)
          .join(", ");
        const text = note(channel, buckets, total);
        return (
          <li
            key={channel}
            data-channel={channel}
            className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3 border-t border-border py-3.5 first:border-t-0"
          >
            <div className="flex min-w-0 flex-[1_1_260px] items-center gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted">
                {Icon ? <Icon size={18} aria-hidden="true" /> : null}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold text-text">{name}</span>
                <span className="text-xs text-text-muted">
                  {channel === "telegram" && telegramDm
                    ? t("dispatch.breakdown.recipientsDm", { value: count(total) })
                    : t("dispatch.breakdown.recipients", { count: total, value: count(total) })}
                </span>
              </div>
              {badge ? <StatusBadge tone={badge.tone} icon={badge.icon} label={t(badge.labelKey)} /> : null}
            </div>
            <div className="flex min-w-0 flex-[2_1_320px] flex-col gap-2">
              <SegBar
                showLegend={false}
                ariaLabel={t("dispatch.breakdown.segAria", { channel: name, parts })}
                segments={present.map((bucket) => ({
                  key: bucket,
                  label: t(DELIVERY_META[bucket].labelKey),
                  value: buckets[bucket],
                  tone: DELIVERY_META[bucket].chart,
                }))}
              />
              {present.length ? (
                <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0" aria-hidden="true">
                  {present.map((bucket) => (
                    <li key={bucket} className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-text">
                      <span className={cx("size-2 shrink-0 rounded-full", CHART_FILL[DELIVERY_META[bucket].chart])} />
                      {t(DELIVERY_META[bucket].labelKey)}
                      <span className="font-semibold tabular-nums">{count(buckets[bucket])}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {text ? <p className="m-0 text-xs text-text-muted">{text}</p> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
};

