import { memo, useState } from "react";
import { Alert, Button, Input, Space, Table, Typography } from "antd";
import { useLogisticsCoverage } from "../../entities/logistics/logisticsCoverage";

const { Title, Text } = Typography;

const columns = [
  { title: "ID", dataIndex: "id", key: "id" },
  { title: "Buyurtma", dataIndex: "order_id", key: "order_id" },
  { title: "Holat", dataIndex: "status", key: "status" },
];

const LogisticsOpsPage = () => {
  const { useGetReturnRequestsList, approveReturnRequest } = useLogisticsCoverage();

  const returnRequests = useGetReturnRequestsList();

  const [payload, setPayload] = useState("");

  const dataSource: unknown[] = Array.isArray(returnRequests.data)
    ? (returnRequests.data as unknown[])
    : [];

  const handleApprove = () => {
    let parsed: unknown = {};
    if (payload) {
      try {
        parsed = JSON.parse(payload);
      } catch {
        parsed = { raw: payload };
      }
    }
    approveReturnRequest.mutate(parsed);
  };

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 pt-4 pb-28 md:pb-4">
      <Title level={3}>Logistika — qaytarish so'rovlari</Title>
      <Text type="secondary">
        Qaytarish so'rovlari ro'yxati va ularni tasdiqlash paneli.
      </Text>

      <Space direction="vertical" size="middle" style={{ display: "flex", marginTop: 20 }}>
        <Table
          size="small"
          rowKey={(r: any) => r.id ?? r.order_id ?? JSON.stringify(r)}
          columns={columns}
          dataSource={dataSource as any[]}
          loading={returnRequests.isLoading}
          pagination={false}
          scroll={{ x: "max-content" }}
        />

        <Space direction="vertical" style={{ display: "flex" }}>
          <Input
            aria-label="approve-payload"
            placeholder='{"order_id": "..."} (ixtiyoriy)'
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
          />
          <Button
            type="primary"
            loading={approveReturnRequest.isPending}
            onClick={handleApprove}
          >
            Tasdiqlash
          </Button>
          {approveReturnRequest.isSuccess ? (
            <Alert type="success" showIcon message="So'rov muvaffaqiyatli tasdiqlandi" />
          ) : null}
          {approveReturnRequest.isError ? (
            <Alert type="error" showIcon message="Xatolik yuz berdi" />
          ) : null}
        </Space>
      </Space>
    </div>
  );
};

export default memo(LogisticsOpsPage);
