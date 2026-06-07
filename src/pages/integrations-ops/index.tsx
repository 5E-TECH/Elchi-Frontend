import { memo, useState } from "react";
import { Alert, Button, Input, Space, Table, Typography } from "antd";
import { useIntegrationsCoverage } from "../../entities/integrations/integrationsCoverage";

const { Title, Text } = Typography;

const receivablesColumns = [
  { title: "ID", dataIndex: "id", key: "id" },
  { title: "Summa", dataIndex: "amount", key: "amount" },
  { title: "Holat", dataIndex: "status", key: "status" },
];

const IntegrationsOpsPage = () => {
  const { getReceivables, sync } = useIntegrationsCoverage();

  const receivables = getReceivables();

  const [integrationId, setIntegrationId] = useState("");

  return (
    <div style={{ padding: 16, maxWidth: 920, margin: "0 auto" }}>
      <Title level={3}>Integratsiyalar</Title>
      <Text type="secondary">
        Integratsiya operatsiyalari: debitorlik qarzlari va sinxronizatsiya.
      </Text>

      <Space direction="vertical" size="large" style={{ display: "flex", marginTop: 20 }}>
        <Table
          size="small"
          rowKey="id"
          pagination={false}
          columns={receivablesColumns}
          dataSource={(receivables.data as any[]) ?? []}
          loading={receivables.isLoading}
        />

        <Space direction="vertical" style={{ display: "flex" }}>
          <Input
            aria-label="integration-id"
            placeholder="Integratsiya ID"
            value={integrationId}
            onChange={(e) => setIntegrationId(e.target.value)}
          />
          <Button
            type="primary"
            loading={sync.isPending}
            onClick={() => sync.mutate({ id: integrationId })}
          >
            Sync
          </Button>
          {sync.isSuccess ? (
            <Alert type="success" showIcon message="Sinxronizatsiya muvaffaqiyatli bajarildi" />
          ) : null}
        </Space>
      </Space>
    </div>
  );
};

export default memo(IntegrationsOpsPage);
