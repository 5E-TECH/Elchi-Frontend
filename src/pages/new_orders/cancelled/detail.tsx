import { memo, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useOrders } from "../../../entities/orders";
import OrdersTable from "../../orders/list/OrdersTable";
import BackButton from "../../../shared/ui/BackButton";
import HeaderName from "../../../shared/components/headerName";
import { XCircle } from "lucide-react";
import { extractCancelledOrders } from "./utils";
import QueryErrorState from "../../../shared/ui/QueryErrorState";

const CancelledMarketDetail = () => {
  const { t } = useTranslation("newOrders");
  const navigate = useNavigate();
  const { marketId = "" } = useParams();
  const { useCancelledOrdersByMarket } = useOrders();
  const query = useCancelledOrdersByMarket(marketId);
  const orders = useMemo(() => extractCancelledOrders(query.data), [query.data]);
  const marketName = orders[0]?.market?.name ?? t("marketName");

  return (
    <div className="space-y-4 pb-24 md:pb-4">
      <div className="flex items-start gap-3">
        <BackButton to="/new-orders/cancelled" className="mt-1" />
        <HeaderName
          name={marketName}
          description={t("cancelledMarketDescription", { count: orders.length })}
          icon={<XCircle />}
        />
      </div>

      {query.isError ? (
        <QueryErrorState onRetry={() => void query.refetch()} />
      ) : (
        <OrdersTable
          data={orders}
          isLoading={query.isLoading}
          onRowClick={(order) => navigate(`/orders/edit/${order.id}`)}
        />
      )}
    </div>
  );
};

export default memo(CancelledMarketDetail);
