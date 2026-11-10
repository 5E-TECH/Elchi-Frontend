// dizayn-v2: superadmin-ai-assistant, superadmin-ai-assistant-unavailable
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Badge, Button, Card, Dialog, SkeletonList } from "../../../shared/ui/primitives";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { cx } from "../../../shared/lib/cx";
import { NoticeAlert } from "../../../entities/notification/ui/NoticeAlert";
import type { AiConversationSummary } from "../../../entities/ai-advisor";

/**
 * «Suhbatlar» (maket: yon ustundagi `.el-card` + `nav.el-list`; < 1024 — «Suhbatlar N» tugmasi va pastki varaqa,
 * varaqa maketi yo'q — eng yaqini yon ustundagi ro'yxat; varaqada bandlar `Select` varag'idagi `.el-option` kabi —
 * chegarasiz, radius 8, matn sarlavha bilan bir chiziqda). Bandi — havola `?conversation=<id>` (yangi tabda ham
 * ochiladi), tanlangani `aria-current` + `action-soft`. «90 kun saqlanadi» yozilmaydi (backend'da saqlash muddati
 * hali yo'q). Ko'p bo'lsa — «Ko'proq» (maket yo'q).
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
};

type ListProps = {
  state: ConversationsState;
  selectedId: string | null;
  onSelect?: () => void;
  /** `card` — yon ustun kartasi (qatorlar chetma-chet, chiziq bilan); `sheet` — oyna / pastki varaqa. */
  variant?: "card" | "sheet";
};

const ITEM: Record<NonNullable<ListProps["variant"]>, string> = {
  card:
    "flex min-h-14 items-center gap-3 border-b border-border px-5 py-2.5 text-text last:border-b-0 hover:bg-row-hover " +
    "max-md:px-4",
  sheet: "flex min-h-14 items-center gap-3 rounded-lg px-2.5 py-2 text-text hover:bg-sunken",
};
const ITEM_SELECTED = "bg-action-soft hover:bg-action-soft";
const PAD = { card: "px-5 py-4", sheet: "px-2.5 py-2" } as const;

export const ConversationList = ({ state, selectedId, onSelect, variant = "card" }: ListProps) => {
  const { t } = useTranslation("aiAdvisor");

  if (state.isPending) {
    return (
      <div className={PAD[variant]}>
        <SkeletonList rows={4} />
      </div>
    );
  }

  if (state.isError) {
    return (
      <div className={variant === "card" ? "p-4" : undefined}>
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
    return <p className={cx(PAD[variant], "text-[13px] text-text-muted")}>{t("conversations.empty")}</p>;
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
              className={cx(ITEM[variant], selected && ITEM_SELECTED)}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={cx("truncate text-sm font-semibold", selected ? "text-action-fg" : "text-text")}>
                  {item.title || t("conversations.untitled")}
                </span>
                <span className="text-xs text-text-muted">{formatDateTimeLocalized(item.lastMessageAt ?? item.createdAt)}</span>
              </span>
            </Link>
          );
        })}
      </nav>
      {state.hasMore ? (
        <div className={variant === "card" ? "border-t border-border px-5 py-3" : "px-2.5 pt-2"}>
          <Button variant="link" size="sm" loading={state.loadingMore} onClick={state.loadMore}>
            {t("conversations.more")}
          </Button>
        </div>
      ) : null}
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

/** < 1024: pastki varaqa (telefonda) / oyna (planshetda). */
export const ConversationsDialog = ({
  open,
  onClose,
  state,
  selectedId,
}: {
  open: boolean;
  onClose: () => void;
  state: ConversationsState;
  selectedId: string | null;
}) => {
  const { t } = useTranslation("aiAdvisor");
  return (
    <Dialog open={open} onClose={onClose} title={t("conversations.title")} size="sm">
      <ConversationList state={state} selectedId={selectedId} onSelect={onClose} variant="sheet" />
    </Dialog>
  );
};
