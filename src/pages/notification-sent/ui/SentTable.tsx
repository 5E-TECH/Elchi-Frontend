// dizayn-v2: superadmin-notifications-sent, admin-notifications-sent
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DispatchStatusBadge,
  useAudienceText,
  type SentListItem,
} from "../../../entities/notification-dispatch";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Badge, DataTable, IconButton, Pressable, type DataTableColumn } from "../../../shared/ui/primitives";
import { requestedChannels, resultNote, type ResultNotePart } from "../model/resultNote";

type Props = {
  rows: readonly SentListItem[];
  busy: boolean;
  onOpen: (item: SentListItem) => void;
};

const SUB = "text-[13px] text-text-muted";
/**
 * Ikkinchi darajali ustunlar («Kim yubordi», «Kanallar», ›) kartaning O'Z kengligi bo'yicha ham yashirinadi (konteyner
 * so'rovi): 1024–1279 px da yon menyu ochiq bo'lsa yetti ustun kartaga sig'maydi (maketda bu kenglik yo'q).
 */
export const SECONDARY_COLUMN_CLASS = "@max-[64rem]:hidden";

/**
 * «Yuborilgan xabarlar» jadvali (maket `*-notifications-sent`): Sana · Sarlavha (+ matn boshi) · Kim yubordi ·
 * Kimga · Kanallar · Natija (+ izoh) · tafsilot (›). Planshetda (< 1024) «Kim yubordi», «Kanallar» va › yashirin;
 * telefonda — kartalar (sarlavha + sana, natija, «Kimga:», kanallar · muallif). Sarlavha va karta — tafsilot oynasini
 * ochadi (`Pressable`); «Kimga» — ro'yxat javobidagi `audience` (NS-3, NwlmrcMf: rol, «Hamma», bitta odam — ism · rol,
 * ro'yxat) + qabul qiluvchilar; ichki dispatch (auditoriya `null`) — «—».
 */
export const SentTable = ({ rows, busy, onOpen }: Props) => {
  const { t, i18n } = useTranslation("notifications");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { roleLabel, audienceText } = useAudienceText();
  // Guruh ajratgichi bo'linmas bo'shliq — tor ustunda «1 / 312» bo'lib qatorga sinmasin.
  const count = (value: number) => formatNumberLocalized(value, { language }).replace(/ /g, "\u00a0");
  const when = (value: string | null) => (value ? formatDateTimeLocalized(value, { language }) : "—");

  const channelLabel = (channel: string) =>
    channel === "realtime" ? t("sent.channelShort.realtime") : t(`dispatch.channel.${channel}`);
  const channelList = (channels: string[]) => channels.map(channelLabel).join(", ");
  const countList = (counts: Array<[string, number]>) =>
    counts.map(([channel, value]) => `${channelLabel(channel)} ${count(value)}`).join(", ");

  const noteText = (item: SentListItem, part: ResultNotePart) => {
    switch (part.kind) {
      case "running":
        return t("sent.note.running", { time: when(item.created_at) });
      case "failed":
        return t("sent.note.failed");
      case "muted":
        return t("sent.note.skipped", { value: count(part.value) });
      case "noProvider":
        return t("sent.note.noProvider", { channels: channelList(part.channels) });
      case "failedChannels":
        return t("sent.note.failedChannels", { list: countList(part.counts) });
      case "skippedChannels":
        return t("sent.note.skippedChannels", { list: countList(part.counts) });
    }
  };
  const note = (item: SentListItem) =>
    resultNote(item)
      .map((part) => noteText(item, part))
      .join(" · ");

  const title = (item: SentListItem) => item.title || t("sent.untitled");
  const recipientsCount = (item: SentListItem) => item.dispatched + item.skipped_by_preference;
  const recipientsText = (item: SentListItem) => {
    // Yuborilayotganda raqam hali yo'q (yakunda yoziladi) — izoh chiqmaydi.
    if (item.status === "running" && !recipientsCount(item)) return null;
    return recipientsCount(item) > 0
      ? t("sent.recipients", { count: recipientsCount(item), value: count(recipientsCount(item)) })
      : t("sent.recipientsNone");
  };
  const audience = (item: SentListItem) => audienceText(item.audience) ?? "—";
  const authorName = (item: SentListItem) => item.created_by?.name || "—";
  const authorRole = (item: SentListItem) => roleLabel(item.created_by?.role);
  const openLabel = (item: SentListItem) => t("sent.openRow", { title: title(item), time: when(item.created_at) });

  const columns: DataTableColumn<SentListItem>[] = [
    {
      id: "date",
      header: t("sent.columns.date"),
      className: "whitespace-nowrap",
      cell: (item) => when(item.created_at),
    },
    {
      id: "title",
      header: t("sent.columns.title"),
      cell: (item) => (
        <div className="flex min-w-[160px] max-w-[240px] flex-col gap-0.5">
          <Pressable className="text-left font-semibold text-text hover:text-action-hover" onClick={() => onOpen(item)}>
            {title(item)}
          </Pressable>
          {/* `w-0 min-w-full` — qisqartirilgan matn ustun kengligini o'zi belgilamasin (tor kartada sarlavha ustuni toraysin). */}
          {item.body_preview ? <span className={`${SUB} w-0 min-w-full truncate`}>{item.body_preview}</span> : null}
        </div>
      ),
    },
    {
      id: "author",
      header: t("sent.columns.author"),
      hideBelow: "lg",
      className: SECONDARY_COLUMN_CLASS,
      cell: (item) => (
        <>
          <div className="whitespace-nowrap">{authorName(item)}</div>
          {authorRole(item) ? <div className={SUB}>{authorRole(item)}</div> : null}
        </>
      ),
    },
    {
      id: "audience",
      header: t("sent.columns.audience"),
      className: "min-w-[112px]",
      cell: (item) => (
        <>
          {/* Uzun ism («Abdurahmonov Muhammadali · Курьер») ustunni kengaytirmasin — tor kartada so'z ichidan o'raladi. */}
          <div className="[overflow-wrap:anywhere]">{audience(item)}</div>
          {recipientsText(item) ? <div className={SUB}>{recipientsText(item)}</div> : null}
        </>
      ),
    },
    {
      id: "channels",
      header: t("sent.columns.channels"),
      hideBelow: "lg",
      className: `max-w-[168px] ${SECONDARY_COLUMN_CLASS}`,
      cell: (item) => {
        const channels = requestedChannels(item);
        return channels.length ? (
          <span className="flex flex-wrap gap-1">
            {channels.map((channel) => (
              <Badge key={channel}>{channelLabel(channel)}</Badge>
            ))}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        );
      },
    },
    {
      id: "status",
      header: t("sent.columns.status"),
      cell: (item) => {
        const text = note(item);
        return (
          <>
            <DispatchStatusBadge status={item.status} />
            {text ? <div className={`${SUB} mt-1 max-w-[180px]`}>{text}</div> : null}
          </>
        );
      },
    },
    {
      id: "open",
      header: <span className="sr-only">{t("sent.columns.open")}</span>,
      hideBelow: "lg",
      // Tor kartada ham yashirin — sarlavha (`Pressable`) va qator bosilishi tafsilotni ochadi.
      className: `w-14 ${SECONDARY_COLUMN_CLASS}`,
      cell: (item) => (
        <IconButton
          size="sm"
          variant="ghost"
          icon={ChevronRight}
          label={openLabel(item)}
          className="text-text-muted"
          onClick={() => onOpen(item)}
        />
      ),
    },
  ];

  const renderCard = (item: SentListItem) => {
    const text = note(item);
    const channels = channelList(requestedChannels(item));
    const recipients = recipientsText(item);
    return (
      <Pressable
        className="flex w-full min-w-0 flex-col gap-1.5 px-4 py-3 text-left text-sm text-text"
        onClick={() => onOpen(item)}
      >
        <span className="flex min-w-0 items-start justify-between gap-2">
          <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{title(item)}</span>
          <span className={`${SUB} flex-none whitespace-nowrap`}>{when(item.created_at)}</span>
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <DispatchStatusBadge status={item.status} />
          {text ? <span className={SUB}>{text}</span> : null}
        </span>
        <span className="min-w-0 text-[13px]">
          <span className="text-text-muted">{t("sent.toLabel")}</span>{" "}
          {[audience(item), recipients].filter(Boolean).join(" · ")}
        </span>
        <span className={SUB}>{[channels, item.created_by?.name].filter(Boolean).join(" · ")}</span>
      </Pressable>
    );
  };

  return (
    <div className="@container min-w-0">
      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(item) => item.dispatch_id}
        label={t("sent.listTitle")}
        cardsLabel={t("sent.listTitle")}
        onRowClick={onOpen}
        renderCard={renderCard}
        busy={busy}
      />
    </div>
  );
};
