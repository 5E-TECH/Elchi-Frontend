import { memo, useState } from "react";
import { Alert, Button, Input, Space, Table, Typography } from "antd";
import { useInvestors } from "../../entities/investors";

const { Title, Text } = Typography;

const columns = [
  { title: "ID", dataIndex: "id", key: "id" },
  { title: "Ism", dataIndex: "name", key: "name" },
  { title: "Telefon", dataIndex: "phone_number", key: "phone_number" },
];

const InvestorsOpsPage = () => {
  const { useGetInvestors, createInvestor } = useInvestors();

  const investorsQuery = useGetInvestors();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const handleCreate = () => {
    createInvestor.mutate({ name, phone_number: phone });
  };

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 pt-4 pb-28 md:pb-4">
      <Title level={3}>Investorlar</Title>
      <Text type="secondary">
        Barcha investorlar ro'yxati va yangi investor qo'shish.
      </Text>

      <Table
        style={{ marginTop: 20 }}
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={(investorsQuery.data as any[]) ?? []}
        loading={investorsQuery.isLoading}
        pagination={false}
        scroll={{ x: "max-content" }}
      />

      <Space direction="vertical" style={{ display: "flex", marginTop: 20 }}>
        <Input
          aria-label="investor-name"
          placeholder="Investor ismi"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          aria-label="investor-phone"
          placeholder="Telefon raqami"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Button
          type="primary"
          loading={createInvestor.isPending}
          onClick={handleCreate}
        >
          Qo'shish
        </Button>
        {createInvestor.isSuccess ? (
          <Alert type="success" showIcon message="Investor muvaffaqiyatli qo'shildi" />
        ) : null}
      </Space>
    </div>
  );
};

export default memo(InvestorsOpsPage);
