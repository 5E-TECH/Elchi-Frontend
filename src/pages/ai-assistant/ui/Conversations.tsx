// dizayn-v2: superadmin-ai-assistant, superadmin-ai-assistant-unavailable, superadmin-ai-assistant-conversations-sheet
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Check, ChevronDown, CircleX, History, MessageSquarePlus, RefreshCw } from "lucide-react";
import { Badge, Button, Card, Dialog, EmptyState, Skeleton } from "../../../shared/ui/primitives";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { cx } from "../../../shared/lib/cx";
import { NoticeAlert } from "../../../entities/notification/ui/NoticeAlert";
import type { AiConversationSummary } from "../../../entities/ai-advisor";

/**
 * «Suhbatlar»:
 *   - ≥ 1024 — yon ustun kartasi (maket `superadmin-ai-assistant`: `.el-card` + `nav.el-list`, sarlavhada «N ta»;
 *     bo'sh — kartada xira matn «Hali suhbat yo'q.», maket `-empty`);
 *   - < 1024 — «Suhbatlar N» tugmasi va oyna (planshetda markazda, telefonda pastki varaqa; maket
 *     `superadmin-ai-assistant-conversations-sheet`): sarlavha «Suhbatlar» + «N ta», ostida «Yangi suhbat» (secondary,
 *     to'liq en, MessageSquarePlus), ro'yxat chetdan chetga (`.el-list-item`), tanlangan bandda `action-soft` + Check
 *     («Ochiq suhbat»); faqat ro'yxat aylanadi («Yangi suhbat» qatori yopishgan). Oyna kengligi 400 (maket).
 *
 * Bandi — havola `?conversation=<id>` (yangi tabda ham ochiladi), tanlangani `aria-current`. Holatlar (maket
 * «Boshqa holatlar», ikkala ko'rinishda bir xil): skelet (ikki qatorli bandlar, «Suhbatlar yuklanmoqda»), xato +
 * «Qayta urinish», bo'sh (varaqada — `EmptyState` History), 50 tadan ko'p bo'lsa «Ko'proq» (ghost, to'liq en) va ostida
 * «{yuklangan} / {jami} ta suhbat ko'rsatildi», bosilganda — «Yuklanmoqda…», keyingi sahifa xatosi — «Keyingi
 * suhbatlarni yuklab bo'lmadi.» + «Qayta urinish», bir necha sahifa yuklanib oxiriga yetilsa — «Hammasi ko'rsatildi ·
 * N ta suhbat». «90 kun saqlanadi» yozilmaydi (ega qarori 5 — backend'da saqlash muddati hali yo'q).
 */

export type ConversationsState = {
  items: AiConversationSummary[];
  total: number;
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
  refetching: boolean;
  hasMore: boolean;
  loadMore: () => void;
  loadingMore: boolean;
  /** Keyingi sahifa («Ko'proq») yuklanmadi — ro'yxat joyida, ostida xato + «Qayta urinish». */
  loadMoreError: boolean;
  /** Bir necha sahifa yuklangan va ro'yxat oxiriga yetildi — «Hammasi ko'rsatildi · N ta suhbat». */
  complete: boolean;
};

type ListVariant = "card" | "sheet";

type ListProps = {
  state: ConversationsState;
  selectedId: string | null;
  onSelect?: () => void;
  /** `card` — yon ustun kartasi; `sheet` — oyna / pastki varaqa (chetdan chetga, tanlanganida Check). */
  variant?: ListVariant;
};

/** `.el-list-item`: varaqada chekka oyna sarlavhasi bilan bir chiziqda (planshet 24, telefon 16). */
const PAD_X: Record<ListVariant, string> = { card: "px-5 max-md:px-4", sheet: "px-6 max-md:px-4" };
const ITEM = "flex min-h-14 items-center gap-3 border-b border-border py-2.5 text-text last:border-b-0 hover:bg-row-hover";
const ITEM_SELECTED = "bg-action-soft hover:bg-action-soft";

/** Maketdagi skelet: ikki qatorli bandlar, orasida chiziq. */
const SKELETON_ROWS: ReadonlyArray<readonly [string, string]> = [
  ["72%", "32%"],
  ["58%", "28%"],
  ["66%", "30%"],
];

const ListSkeleton = ({ variant, label }: { variant: ListVariant; label: string }) => (
  <div role="status" aria-label={label} className={cx("flex flex-col", PAD_X[variant], variant === "card" && "py-1.5")}>
    {SKELETON_ROWS.map(([title, sub]) => (
      <div key={title} className="flex flex-col gap-2 border-t border-border py-2.5 first:border-t-0">
        <Skeleton width={title} tone="border" />
        <Skeleton width={sub} tone="border" />
      </div>
    ))}
  </div>
);

/** Ro'yxat ostidagi qism: «Ko'proq» (+ nechtasi ko'rsatilgani), yuklanmoqda, keyingi sahifa xatosi, ro'yxat oxiri. */
const ListFooter = ({ state, variant }: { state: ConversationsState; variant: ListVariant }) => {
  const { t } = useTranslation("aiAdvisor");
  const shownId = useId();
  const box = cx("border-t border-border py-3", PAD_X[variant]);

  if (state.loadMoreError && !state.loadingMore) {
    return (
      <div className={cx(box, "flex flex-col gap-2")}>
        <p role="alert" className="flex items-start gap-2 text-[13px] text-danger-fg">
          <CircleX size={16} aria-hidden="true" className="mt-px flex-none" />
          <span>{t("conversations.moreError")}</span>
        </p>
        <Button variant="secondary" size="sm" leftIcon={RefreshCw} className="self-start" onClick={state.loadMore}>
          {t("conversations.retry")}
        </Button>
      </div>
    );
  }
  if (state.hasMore || state.loadingMore) {
    return (
      <div className={cx(box, "flex flex-col items-stretch gap-1.5")}>
        <Button
          variant="ghost"
          fullWidth
          leftIcon={ChevronDown}
          loading={state.loadingMore}
          loadingText={t("conversations.loadingMore")}
          aria-describedby={state.loadingMore ? undefined : shownId}
          onClick={state.loadMore}
        >
          {t("conversations.more")}
        </Button>
        {state.loadingMore ? null : (
          <span id={shownId} className="text-center text-xs text-text-muted">
            {t("conversations.moreShown", {
              loaded: formatNumberLocalized(state.items.length),
              total: formatNumberLocalized(state.total),
            })}
          </span>
        )}
      </div>
    );
  }
  if (state.complete) {
    return (
      <p className={cx(box, "text-center text-xs text-text-muted")}>
        {t("conversations.allShown", { value: formatNumberLocalized(state.total) })}
      </p>
    );
  }
  return null;
};

export const ConversationList = ({ state, selectedId, onSelect, variant = "card" }: ListProps) => {
  const { t } = useTranslation("aiAdvisor");

  if (state.isPending) return <ListSkeleton variant={variant} label={t("conversations.loading")} />;

  if (state.isError) {
    return (
      <div className={variant === "card" ? "p-4" : cx("py-3", PAD_X.sheet)}>
        <NoticeAlert
          tone="danger"
          title={t("conversations.errorTitle")}
          action={
            <Button variant="secondary" size="sm" leftIcon={RefreshCw} loading={state.refetching} onClick={state.refetch}>
              {t("conversations.retry")}
            </Button>
          }
        >
          {t("conversations.errorText")}
        </NoticeAlert>
      </div>
    );
  }

  if (state.items.length === 0) {
    return variant === "sheet" ? (
      <EmptyState icon={History} title={t("conversations.emptyTitle")} description={t("conversations.emptyText")} />
    ) : (
      <p className="px-5 py-4 text-[13px] text-text-muted max-md:px-4">{t("conversations.empty")}</p>
    );
  }

  return (
    <div className="flex flex-col">
      <nav aria-label={t("conversations.listLabel")} className="flex flex-col">
        {state.items.map((item) => {
          const selected = item.id === selectedId;
          return (
            <Link
              key={item.id}
              to={{ search: `?conversation=${item.id}` }}
              aria-current={selected ? "true" : undefined}
              onClick={onSelect}
              className={cx(ITEM, PAD_X[variant], selected && ITEM_SELECTED)}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={cx("truncate text-sm font-semibold", selected ? "text-action-fg" : "text-text")}>
                  {item.title || t("conversations.untitled")}
                </span>
                <span className="text-xs text-text-muted">{formatDateTimeLocalized(item.lastMessageAt ?? item.createdAt)}</span>
              </span>
              {selected && variant === "sheet" ? (
                <span className="inline-flex flex-none text-action-fg">
                  <span className="sr-only">{t("conversations.current")}</span>
                  <Check size={18} aria-hidden="true" />
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <ListFooter state={state} variant={variant} />
    </div>
  );
};

export const ConversationsCount = ({ total }: { total: number }) => {
  const { t } = useTranslation("aiAdvisor");
  return <Badge tone="neutral">{t("conversations.count", { value: formatNumberLocalized(total) })}</Badge>;
};

/** Yon ustun kartasi (≥ 1024). */
export const ConversationsCard = ({ state, selectedId }: { state: ConversationsState; selectedId: string | null }) => {
  const { t } = useTranslation("aiAdvisor");
  return (
    <Card padding="none" title={t("conversations.title")} actions={state.isPending || state.isError ? undefined : <ConversationsCount total={state.total} />}>
      <ConversationList state={state} selectedId={selectedId} />
    </Card>
  );
};

/** < 1024: oyna (planshetda) / pastki varaqa (telefonda) — maket `-conversations-sheet`. */
export const ConversationsDialog = ({
  open,
  onClose,
  state,
  selectedId,
  onNewChat,
}: {
  open: boolean;
  onClose: () => void;
  state: ConversationsState;
  selectedId: string | null;
  /** «Yangi suhbat» (varaqa ichida): suhbat tozalanadi va varaqa yopiladi (chaqiruvchi). */
  onNewChat: () => void;
}) => {
  const { t } = useTranslation("aiAdvisor");
  // Son — ro'yxat kelgandan keyin (yuklanish / xatoda «0 ta» yolg'on bo'lardi).
  const count =
    state.isPending || state.isError
      ? undefined
      : t("conversations.sheetCount", { count: state.total, value: formatNumberLocalized(state.total) });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("conversations.title")}
      description={count}
      closeLabel={t("conversations.close")}
      size="sm"
      className="md:max-w-[400px]"
      // Ro'yxat oyna chetidan chetiga (maket `.el-list-item`): tana gorizontal chekkasiz, faqat u aylanadi.
      bodyClassName="-mx-6 px-0 max-md:-mx-4"
    >
      <div className="flex flex-col">
        <div className="sticky -top-1 z-[1] border-y border-border bg-raised px-6 py-3 max-md:px-4">
          <Button variant="secondary" fullWidth leftIcon={MessageSquarePlus} onClick={onNewChat}>
            {t("newChat")}
          </Button>
        </div>
        <ConversationList state={state} selectedId={selectedId} onSelect={onClose} variant="sheet" />
      </div>
    </Dialog>
  );
};
