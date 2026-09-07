import { useMemo, useState } from "react";
import { Badge, Button, Pagination, Segmented, Spin, message } from "antd";
import { BellOff, CheckCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useInboxList } from "../../../entities/notification-inbox";
import { useMarkAllInboxRead } from "../../../features/notification-inbox";
import EmptyState from "../../../shared/ui/EmptyState";
import QueryErrorState from "../../../shared/ui/QueryErrorState";
import NotificationInboxItem from "./NotificationInboxItem";

const PAGE_SIZE = 20;
type InboxTab = "all" | "unread";

const NotificationInboxList = () => {
  const { t } = useTranslation("notifications");
  const [tab, setTab] = useState<InboxTab>("all");
  const [page, setPage] = useState(1);

  const params = useMemo(
    () => ({ page, limit: PAGE_SIZE, is_read: tab === "unread" ? false : undefined }),
    [page, tab],
  );

  const { data, isLoading, isError, refetch, isFetching } = useInboxList(params);
  const markAllRead = useMarkAllInboxRead();

  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;
  const total = data?.total ?? 0;

  const changeTab = (next: InboxTab) => {
    setTab(next);
    setPage(1);
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead.mutateAsync();
      message.success(t("markAllReadSuccess"));
    } catch {
      message.error(t("markAllReadError"));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<InboxTab>
          value={tab}
          onChange={(value) => changeTab(value)}
          options={[
            { label: t("tabs.all"), value: "all" },
            {
              label: (
                <span className="inline-flex items-center gap-2">
                  {t("tabs.unread")}
                  {unread > 0 ? <Badge count={unread} overflowCount={99} /> : null}
                </span>
              ),
              value: "unread",
            },
          ]}
        />

        <Button
          icon={<CheckCheck size={16} />}
          disabled={unread === 0}
          loading={markAllRead.isPending}
          onClick={handleMarkAllRead}
        >
          {t("markAllRead")}
        </Button>
      </div>

      {isError ? (
        <QueryErrorState description={t("loadError")} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Spin size="large" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<BellOff size={28} />}
          title={tab === "unread" ? t("emptyUnread") : t("empty")}
          description={tab === "unread" ? t("emptyUnreadHint") : t("emptyHint")}
        />
      ) : (
        <>
          <Spin spinning={isFetching && !isLoading}>
            <div className="flex flex-col gap-2.5">
              {items.map((notification) => (
                <NotificationInboxItem key={notification.id} notification={notification} />
              ))}
            </div>
          </Spin>

          {total > PAGE_SIZE ? (
            <div className="flex justify-end pt-2">
              <Pagination
                current={page}
                pageSize={PAGE_SIZE}
                total={total}
                showSizeChanger={false}
                onChange={setPage}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};

export default NotificationInboxList;
