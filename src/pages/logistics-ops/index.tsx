import { memo, useMemo, useState } from "react";
import { Alert, Button, Space, Table, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { useLogisticsCoverage } from "../../entities/logistics/logisticsCoverage";
import { getBackendErrorMessage } from "../../shared/lib/backendError";
import QueryErrorState from "../../shared/ui/QueryErrorState";
import { extractReturnRequestRows, type ReturnRequestRow } from "./lib/returnRequestRows";

const { Title, Text } = Typography;

const LogisticsOpsPage = () => {
  const { t } = useTranslation("returns");
  const { useGetReturnRequestsList, approveReturnRequest } = useLogisticsCoverage();

  const returnRequests = useGetReturnRequestsList();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // fix3 CODE-09 / C13: javob `data.groups[].orders` — kuryer bo'yicha guruhlangan.
  const dataSource = extractReturnRequestRows(returnRequests.data);

  const columns = useMemo(
    () => [
      { title: t("opsReturnRequests.columns.id"), dataIndex: "id", key: "id" },
      { title: t("opsReturnRequests.columns.order"), dataIndex: "order_id", key: "order_id" },
      { title: t("opsReturnRequests.columns.status"), dataIndex: "status", key: "status" },
      { title: t("opsReturnRequests.columns.courier"), dataIndex: "courier", key: "courier" },
    ],
    [t],
  );

  // Tanlov faqat ro'yxatda hozir bor qatorlardan — yangilangan ro'yxatda
  // yo'qolgan qator yuborilmaydi.
  const selectedOrderIds = dataSource
    .filter((row) => selectedKeys.includes(row.key))
    .map((row) => row.order_id || row.id)
    .filter(Boolean);

  /**
   * fix3b CODE-09: tasdiqlash ilgari erkin JSON (`{"order_id": "..."}`)
   * yuborardi, `ReturnRequestsActionRequestDto` esa faqat
   * `{ order_ids: string[] }` qabul qiladi — har doim 400. Endi tanlangan
   * qatorlarning buyurtma id lari yuboriladi.
   */
  const handleApprove = () => {
    if (selectedOrderIds.length === 0) return;
    approveReturnRequest.mutate(
      { order_ids: selectedOrderIds },
      { onSuccess: () => setSelectedKeys([]) },
    );
  };

  const approveErrorMessage = approveReturnRequest.isError
    ? getBackendErrorMessage(approveReturnRequest.error) ?? t("opsReturnRequests.approveError")
    : null;

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 pt-4 pb-28 md:pb-4">
      <Title level={3}>{t("opsReturnRequests.title")}</Title>
      <Text type="secondary">{t("opsReturnRequests.description")}</Text>

      <Space direction="vertical" size="middle" style={{ display: "flex", marginTop: 20 }}>
        {returnRequests.isError ? (
          <QueryErrorState
            description={t("opsReturnRequests.loadError")}
            onRetry={() => void returnRequests.refetch()}
          />
        ) : (
          <Table<ReturnRequestRow>
            size="small"
            rowKey="key"
            columns={columns}
            dataSource={dataSource}
            loading={returnRequests.isLoading}
            pagination={false}
            scroll={{ x: "max-content" }}
            locale={{ emptyText: t("opsReturnRequests.empty") }}
            rowSelection={{
              selectedRowKeys: selectedKeys,
              onChange: (keys) => setSelectedKeys(keys.map(String)),
            }}
          />
        )}

        <Space direction="vertical" style={{ display: "flex" }}>
          <Button
            type="primary"
            loading={approveReturnRequest.isPending}
            disabled={selectedOrderIds.length === 0}
            onClick={handleApprove}
          >
            {t("opsReturnRequests.approve", { count: selectedOrderIds.length })}
          </Button>
          {selectedOrderIds.length === 0 && dataSource.length > 0 ? (
            <Text type="secondary">{t("opsReturnRequests.selectHint")}</Text>
          ) : null}
          {approveReturnRequest.isSuccess ? (
            <Alert type="success" showIcon message={t("opsReturnRequests.approveSuccess")} />
          ) : null}
          {approveErrorMessage ? (
            <Alert type="error" showIcon message={approveErrorMessage} />
          ) : null}
        </Space>
      </Space>
    </div>
  );
};

export default memo(LogisticsOpsPage);
