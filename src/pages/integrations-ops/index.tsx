import { memo, useState } from "react";
import { Alert, Button, Input, Space, Table, Typography } from "antd";
import { useIntegrationsCoverage } from "../../entities/integrations/integrationsCoverage";
import { getBackendErrorMessage } from "../../shared/lib/backendError";

const { Title, Text } = Typography;

const receivablesColumns = [
  { title: "ID", dataIndex: "id", key: "id" },
  { title: "Summa", dataIndex: "amount", key: "amount" },
  { title: "Holat", dataIndex: "status", key: "status" },
];

// Backend `{ data: { items, pagination } }` qaytaradi; massiv bo'lmagan
// obyekt antd Table'ga tushsa butun sahifa qulaydi.
const extractReceivableItems = (body: unknown): Record<string, unknown>[] => {
  if (Array.isArray(body)) return body;
  const record = (body ?? {}) as { items?: unknown; data?: { items?: unknown } };
  if (Array.isArray(record.data?.items)) return record.data.items as Record<string, unknown>[];
  if (Array.isArray(record.items)) return record.items as Record<string, unknown>[];
  return [];
};

const IntegrationsOpsPage = () => {
  const { useGetReceivables, sync } = useIntegrationsCoverage();

  const receivables = useGetReceivables();
  const receivableItems = extractReceivableItems(receivables.data);

  const [integrationId, setIntegrationId] = useState("");

  return (
    <div className="mx-auto w-full max-w-[920px] px-4 pt-4 pb-28 md:pb-4">
      <Title level={3}>Integratsiyalar</Title>
      <Text type="secondary">
        Integratsiya operatsiyalari: debitorlik qarzlari va sinxronizatsiya.
      </Text>

      <Space direction="vertical" size="large" style={{ display: "flex", marginTop: 20 }}>
        {receivables.isError ? (
          <Alert
            type="error"
            showIcon
            title="Debitorlik qarzlarini yuklab bo'lmadi"
            description={getBackendErrorMessage(receivables.error)}
            action={
              <Button
                size="small"
                danger
                loading={receivables.isFetching}
                onClick={() => void receivables.refetch()}
              >
                Qayta urinish
              </Button>
            }
          />
        ) : (
          <Table
            size="small"
            rowKey="id"
            pagination={false}
            columns={receivablesColumns}
            dataSource={receivableItems}
            loading={receivables.isLoading}
            scroll={{ x: "max-content" }}
          />
        )}

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
            disabled={!integrationId.trim()}
            onClick={() => sync.mutate({ id: integrationId.trim() })}
          >
            Sync
          </Button>
          {sync.isSuccess ? (
            <Alert type="success" showIcon title="Sinxronizatsiya muvaffaqiyatli bajarildi" />
          ) : null}
          {sync.isError ? (
            <Alert
              type="error"
              showIcon
              title="Sinxronizatsiya bajarilmadi"
              description={getBackendErrorMessage(sync.error)}
            />
          ) : null}
        </Space>
      </Space>
    </div>
  );
};

export default memo(IntegrationsOpsPage);
