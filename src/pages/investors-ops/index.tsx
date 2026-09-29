import { memo, useState } from "react";
import { Alert, Button, Input, Space, Table, Typography } from "antd";
import { useInvestors } from "../../entities/investors";

const { Title, Text } = Typography;

const columns = [
  { title: "ID", dataIndex: "id", key: "id" },
  { title: "Ism", dataIndex: "name", key: "name" },
  { title: "Telefon", dataIndex: "phone_number", key: "phone_number" },
];

const PAGE_SIZE = 10;

const InvestorsOpsPage = () => {
  const { useGetInvestors, createInvestor } = useInvestors();

  const [page, setPage] = useState(1);
  const investorsQuery = useGetInvestors({ page, limit: PAGE_SIZE });
  const investorRows = Array.isArray(investorsQuery.data?.items) ? investorsQuery.data.items : [];
  const total = investorsQuery.data?.meta?.total ?? investorRows.length;

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
        dataSource={investorRows}
        loading={investorsQuery.isLoading}
        locale={{ emptyText: "Investorlar yo'q" }}
        pagination={
          total > PAGE_SIZE
            ? { current: page, pageSize: PAGE_SIZE, total, onChange: setPage, showSizeChanger: false }
            : false
        }
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
