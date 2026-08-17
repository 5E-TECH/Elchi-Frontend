import { memo, useState } from "react";
import { Alert, Button, Input, Space, Table, Typography } from "antd";
import { useBranchCoverage } from "../../entities/branch/branchCoverage";

const { Title, Text } = Typography;

const columns = [
  { title: "ID", dataIndex: "id", key: "id" },
  { title: "Nomi", dataIndex: "name", key: "name" },
  { title: "Yangi buyurtmalar", dataIndex: "new_orders_count", key: "new_orders_count" },
];

const BranchOpsPage = () => {
  const { useGetNewOrders, cancelBatch } = useBranchCoverage();

  const newOrders = useGetNewOrders();

  const [batchId, setBatchId] = useState("");

  const dataSource: object[] = Array.isArray(newOrders.data) ? newOrders.data : [];

  return (
    <div style={{ padding: 16, maxWidth: 920, margin: "0 auto" }}>
      <Title level={3}>Filiallar — operatsiyalar</Title>
      <Text type="secondary">
        Yangi buyurtmali filiallar ro'yxati va partiyalarni boshqarish.
      </Text>

      <Space direction="vertical" size="large" style={{ display: "flex", marginTop: 20 }}>
        <Table
          rowKey="id"
          size="small"
          loading={newOrders.isLoading}
          columns={columns}
          dataSource={dataSource}
          pagination={false}
        />

        <Space direction="horizontal">
          <Input
            aria-label="batch-id"
            placeholder="Partiya ID"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
          />
          <Button
            type="primary"
            loading={cancelBatch.isPending}
            onClick={() => cancelBatch.mutate({ id: batchId, data: {} })}
          >
            Batchni bekor qilish
          </Button>
        </Space>

        {cancelBatch.isSuccess ? (
          <Alert
            type="success"
            showIcon
            message="Partiya muvaffaqiyatli bekor qilindi"
          />
        ) : null}
      </Space>
    </div>
  );
};

export default memo(BranchOpsPage);
