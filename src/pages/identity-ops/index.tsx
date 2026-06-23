import { memo, useState } from "react";
import { Alert, Input, Space, Switch, Table, Typography } from "antd";
import { useIdentityCoverage } from "../../entities/identity";

const { Title, Text } = Typography;

const IdentityOpsPage = () => {
  const { useGetAdmins, useGetManagers, useGetRegistrators, addOrderToMarket } =
    useIdentityCoverage();

  const admins = useGetAdmins();
  const managers = useGetManagers();
  const registrators = useGetRegistrators();

  const [marketId, setMarketId] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const handleAddOrder = () => {
    if (!marketId) return;
    setShowSuccess(false);
    addOrderToMarket.mutate(
      { id: marketId, data: {} },
      {
        onSuccess: () => setShowSuccess(true),
      },
    );
  };

  const userColumns = [
    { title: "ID", dataIndex: "id", key: "id" },
    { title: "Ism", dataIndex: "name", key: "name" },
    { title: "Email", dataIndex: "email", key: "email" },
  ];

  return (
    <div className="mx-auto w-full max-w-[920px] px-4 pt-4 pb-28 md:pb-4">
      <Title level={3}>Xodimlar — ro'yxatlar</Title>
      <Text type="secondary">
        Adminlar, menejerlar va registratorlar ro'yxatini ko'rish va market
        sozlamalarini boshqarish.
      </Text>

      <Space direction="vertical" size="large" style={{ display: "flex", marginTop: 20 }}>
        <Table
          title={() => "Adminlar"}
          rowKey="id"
          size="small"
          pagination={false}
          loading={admins.isLoading}
          dataSource={(admins.data as unknown[]) ?? []}
          columns={userColumns}
          scroll={{ x: "max-content" }}
        />

        <Table
          title={() => "Menejerlar"}
          rowKey="id"
          size="small"
          pagination={false}
          loading={managers.isLoading}
          dataSource={(managers.data as unknown[]) ?? []}
          columns={userColumns}
          scroll={{ x: "max-content" }}
        />

        <Table
          title={() => "Registratorlar"}
          rowKey="id"
          size="small"
          pagination={false}
          loading={registrators.isLoading}
          dataSource={(registrators.data as unknown[]) ?? []}
          columns={userColumns}
          scroll={{ x: "max-content" }}
        />

        <Space direction="vertical" style={{ display: "flex" }}>
          <Text strong>Market: buyurtma qo'shish</Text>
          <Input
            aria-label="market-id"
            placeholder="Market ID"
            value={marketId}
            onChange={(e) => setMarketId(e.target.value)}
          />
          <Switch
            loading={addOrderToMarket.isPending}
            onClick={handleAddOrder}
            checkedChildren="Qo'shildi"
            unCheckedChildren="Qo'shish"
          />
          {showSuccess && (
            <Alert
              type="success"
              showIcon
              message="Buyurtma muvaffaqiyatli qo'shildi"
            />
          )}
        </Space>
      </Space>
    </div>
  );
};

export default memo(IdentityOpsPage);
