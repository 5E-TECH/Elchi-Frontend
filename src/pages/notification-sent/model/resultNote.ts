import { EXTERNAL_CHANNELS, bucketCounts, type SentListItem } from "../../../entities/notification-dispatch";

/**
 * «Natija» ustunidagi badge ostidagi izoh (maket `*-notifications-sent`). Faqat ro'yxat javobidagi raqamlardan —
 * backend `message` / `error` matni ishlatilmaydi (ega S4):
 *  - yuborilmoqda — «Bugun, 14:20 dan beri»;
 *  - xato — «Hech kimga ketmadi — qayta yuboring»;
 *  - o'tkazib yuborildi — «Bildirishnomani o'chirganlar: 3» (`skipped_by_preference`);
 *  - qisman / faqat ilova ichida — «SMS: provayder ulanmagan», «Xato: Telegram 6», «O'tkazib yuborildi: Telegram 17,
 *    SMS 9» (yakundagi saqlangan `channel_status`; jonli raqamlar — tafsilot oynasida);
 *  - yuborildi — izohsiz.
 */
export type ResultNotePart =
  | { kind: "running" }
  | { kind: "failed" }
  | { kind: "muted"; value: number }
  | { kind: "noProvider"; channels: string[] }
  | { kind: "failedChannels"; counts: Array<[channel: string, count: number]> }
  | { kind: "skippedChannels"; counts: Array<[channel: string, count: number]> };

/** Kanallar chiplari tartibi (maket: Darhol · Telegram · SMS · Push); `in_app` — qatorning o'zi, chizilmaydi. */
export const requestedChannels = (item: Pick<SentListItem, "channels">) =>
  EXTERNAL_CHANNELS.filter((channel) => item.channels.includes(channel));

export const resultNote = (item: SentListItem): ResultNotePart[] => {
  if (item.status === "running") return [{ kind: "running" }];
  if (item.status === "failed") return [{ kind: "failed" }];
  if (item.status === "sent") return [];
  if (item.status === "skipped") {
    return item.skipped_by_preference > 0 ? [{ kind: "muted", value: item.skipped_by_preference }] : [];
  }

  const known = new Set([...item.channels, ...Object.keys(item.channel_status ?? {})]);
  const channels = EXTERNAL_CHANNELS.filter((channel) => known.has(channel) || item.no_provider.includes(channel));
  const buckets = new Map(channels.map((channel) => [channel, bucketCounts(item.channel_status?.[channel])]));
  const noProvider = channels.filter(
    (channel) => item.no_provider.includes(channel) || (buckets.get(channel)?.no_provider ?? 0) > 0,
  );
  const failed = channels
    .filter((channel) => !noProvider.includes(channel))
    .map((channel): [string, number] => [channel, buckets.get(channel)?.failed ?? 0])
    .filter(([, count]) => count > 0);
  const skipped = channels
    .filter((channel) => !noProvider.includes(channel))
    .map((channel): [string, number] => [channel, buckets.get(channel)?.skipped ?? 0])
    .filter(([, count]) => count > 0);

  const parts: ResultNotePart[] = [];
  if (noProvider.length) parts.push({ kind: "noProvider", channels: noProvider });
  if (failed.length) parts.push({ kind: "failedChannels", counts: failed });
  if (skipped.length) parts.push({ kind: "skippedChannels", counts: skipped });
  if (!parts.length && item.skipped_by_preference > 0) parts.push({ kind: "muted", value: item.skipped_by_preference });
  return parts;
};
