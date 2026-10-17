// dizayn-v2: superadmin-neworders-create-manual-step1, superadmin-neworders-create-manual-step2, superadmin-neworders-create-ai-input, market-new-orders-create-manual
import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OrderStatusBadge } from "../../../../entities/order";
import { useOrders as useIncomingOrders } from "../../../../entities/orders";
import { cx } from "../../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../../shared/lib/formatDateTime";
import { formatMoneyLocalized } from "../../../../shared/lib/formatMoney";
import { Badge, Card, EmptyState, QueryBoundary, SkeletonList } from "../../../../shared/ui/primitives";
import type { ApiOrder } from "../../../new_orders/model/apiOrder";
import { toApiList } from "../model/orderCreateForm";

type TodayOrdersCardProps = {
  marketId: string | number;
  marketName?: string;
  /** Market roli: badge «Jami N ta», telefonda karta o'rniga havola-karta (maket `market-new-orders-create-manual`). */
  isMarketRole: boolean;
  className?: string;
};

/** Bitta buyurtma qatori (`.el-list-item` havola): ism · summa / №, tuman, vaqt / holat va yetkazish turi. */
const TodayOrderRow = ({ order, href }: { order: ApiOrder; href: string }) => {
  const { t, i18n } = useTranslation("orders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const district = order.customer?.district?.name ?? order.district?.name;
  const meta = [`№${order.id}`, district, formatDateTimeLocalized(order.createdAt, { language })].filter(Boolean);

  return (
    <li>
      <Link
        to={href}
        className={cx(
          "flex min-h-14 flex-col gap-0.5 border-b border-border px-5 py-3 text-sm",
          "transition-[background-color] duration-150 hover:bg-row-hover motion-reduce:transition-none",
        )}
      >
        <span className="flex min-w-0 items-baseline justify-between gap-3">
          <span className="min-w-0 truncate font-semibold text-text">{order.customer?.name || "—"}</span>
          <span className="shrink-0 whitespace-nowrap font-semibold text-text tabular-nums">
            {formatMoneyLocalized(order.total_price, { language })}
          </span>
        </span>
        <span className="text-[13px] text-text-muted">{meta.join(" · ")}</span>
        <span className="flex flex-wrap items-center gap-1.5 pt-1">
          <OrderStatusBadge status={order.status} />
          <Badge>{order.where_deliver === "center" ? t("deliveryToCenter") : t("deliveryToHome")}</Badge>
        </span>
      </Link>
    </li>
  );
};

/**
 * «YANGI BUYURTMALAR» — tanlangan marketning bugungi yangi buyurtmalari (yon ustun; maketlar
 * `*-create-manual-step1`, `*-create-manual-step2`, `market-new-orders-create-manual`). Sarlavhada
 * «{market} · bugun» va son; qator — buyurtma tafsilotiga havola. Market rolida telefonda (< 768) ro'yxat
 * o'rniga bitta havola-karta («Baraka Shop · bugun · 5 ta» → yangi buyurtmalar ro'yxati).
 */
const TodayOrdersCard = ({ marketId, marketName, isMarketRole, className }: TodayOrdersCardProps) => {
  const { t } = useTranslation("orders");
  const { useGetTodayOrdersByMarket } = useIncomingOrders();
  const query = useGetTodayOrdersByMarket(marketId, undefined, Boolean(marketId));
  const orders = useMemo(() => toApiList<ApiOrder>(query.data), [query.data]);
  const count = orders.length;
  const market = marketName ?? "—";
  const detailHref = (order: ApiOrder) => `/new-orders/${marketId}/edit/${order.id}`;

  return (
    <>
      <Card
        padding="none"
        title={t("newOrders")}
        description={t("createTodayDescription", { market })}
        actions={<Badge>{isMarketRole ? t("createTodayTotal", { count }) : t("createTodayCount", { count })}</Badge>}
        className={cx(isMarketRole && "max-md:hidden", className)}
      >
        <QueryBoundary
          query={query}
          loading={<SkeletonList rows={3} />}
          empty={<EmptyState icon={Inbox} title={t("createTodayEmpty")} />}
        >
          <ul className="m-0 flex list-none flex-col p-0 [&>li:last-child>a]:border-b-0">
            {orders.map((order) => (
              <TodayOrderRow key={order.id} order={order} href={detailHref(order)} />
            ))}
          </ul>
        </QueryBoundary>
      </Card>

      {isMarketRole ? (
        <Link
          to={`/new-orders/${marketId}`}
          aria-label={t("createTodayLinkAria", { count })}
          className={cx(
            "hidden min-h-14 min-w-0 items-center gap-3 rounded-[14px] border border-border bg-surface px-5 py-4 text-text max-md:flex",
            "transition-[background-color] duration-150 hover:bg-row-hover motion-reduce:transition-none",
            className,
          )}
        >
          <span
            aria-hidden="true"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted"
          >
            <Inbox size={18} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate font-semibold text-text">{t("newOrders")}</span>
            <span className="truncate text-[13px] text-text-muted">{t("createTodayLinkSub", { market, count })}</span>
          </span>
          <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-text-subtle" />
        </Link>
      ) : null}
    </>
  );
};

export default memo(TodayOrdersCard);
