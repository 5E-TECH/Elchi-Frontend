import { memo, useState } from "react";
import { Alert, Button, Card, Col, Input, Row, Space, Statistic, Table, Typography } from "antd";
import { Banknote, HandCoins, Search, Wallet } from "lucide-react";
import { useFinanceCoverage } from "../../entities/payments/financeCoverage";

const { Title, Text } = Typography;

/**
 * Finance slice — operator commission tracking (guide §7 finance side).
 * Look up an operator's earned / paid / balance summary, their earnings and
 * payout history, and record a new payout. All via `useFinanceCoverage()`:
 *  GET  finance/operators/{id}/balance | /earnings | /payments
 *  POST finance/operator-payments
 */

interface OperatorBalance {
  earned?: number;
  paid?: number;
  balance?: number;
}

const fmt = (n: unknown) => Number((n as number) || 0).toLocaleString("uz-UZ");
const asRows = (d: unknown): Record<string, unknown>[] =>
  Array.isArray(d) ? d : Array.isArray((d as { data?: unknown })?.data) ? (d as { data: Record<string, unknown>[] }).data : [];

const earningColumns = [
  { title: "Buyurtma", dataIndex: "order_id", key: "order_id", render: (v: unknown) => (v as string) ?? "—" },
  { title: "Miqdor", dataIndex: "amount", key: "amount", render: (v: unknown) => `${fmt(v)} so'm` },
  { title: "Sana", dataIndex: "createdAt", key: "createdAt", render: (v: unknown) => (v as string) ?? "—" },
];

const payoutColumns = [
  { title: "Miqdor", dataIndex: "amount", key: "amount", render: (v: unknown) => `${fmt(v)} so'm` },
  { title: "Izoh", dataIndex: "comment", key: "comment", render: (v: unknown) => (v as string) ?? "—" },
  { title: "Sana", dataIndex: "createdAt", key: "createdAt", render: (v: unknown) => (v as string) ?? "—" },
];

const FinanceOperatorsPage = () => {
  const {
    getOperatorBalance,
    getOperatorEarnings,
    getOperatorPayouts,
    createOperatorPayment,
  } = useFinanceCoverage();

  const [operatorInput, setOperatorInput] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutComment, setPayoutComment] = useState("");

  const enabled = !!operatorId;
  const balanceQuery = getOperatorBalance(operatorId, enabled);
  const earningsQuery = getOperatorEarnings(operatorId, enabled);
  const payoutsQuery = getOperatorPayouts(operatorId, enabled);

  const balance = (balanceQuery.data as OperatorBalance | undefined) ?? {};

  return (
    <div style={{ padding: 16, maxWidth: 920, margin: "0 auto" }}>
      <Title level={3}>
        <Wallet size={20} style={{ verticalAlign: -3, marginRight: 8 }} />
        Operator hisob-kitobi
      </Title>
      <Text type="secondary">
        Operatorning ishlab topgan / to'langan / qoldiq summasi, daromad va to'lov
        tarixi; yangi to'lovni shu yerda qayd qiling.
      </Text>

      <Card style={{ marginTop: 16 }}>
        <Space.Compact style={{ width: "100%" }}>
          <Input
            aria-label="operator-id"
            placeholder="Operator ID"
            value={operatorInput}
            onChange={(e) => setOperatorInput(e.target.value)}
          />
          <Button type="primary" icon={<Search size={16} />} onClick={() => setOperatorId(operatorInput)}>
            Yuklash
          </Button>
        </Space.Compact>
      </Card>

      {enabled ? (
        <Space direction="vertical" size="large" style={{ display: "flex", marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Card><Statistic title="Ishlab topgan" value={fmt(balance.earned)} suffix="so'm" loading={balanceQuery.isLoading} /></Card>
            </Col>
            <Col span={8}>
              <Card><Statistic title="To'langan" value={fmt(balance.paid)} suffix="so'm" loading={balanceQuery.isLoading} /></Card>
            </Col>
            <Col span={8}>
              <Card><Statistic title="Qoldiq" value={fmt(balance.balance)} suffix="so'm" loading={balanceQuery.isLoading} /></Card>
            </Col>
          </Row>

          <Card title={<><HandCoins size={16} style={{ verticalAlign: -3, marginRight: 6 }} />To'lov qayd qilish</>}>
            <Space direction="vertical" style={{ display: "flex" }}>
              <Input aria-label="payout-amount" placeholder="Summa (so'm)" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} />
              <Input aria-label="payout-comment" placeholder="Izoh" value={payoutComment} onChange={(e) => setPayoutComment(e.target.value)} />
              <Button
                type="primary"
                loading={createOperatorPayment.isPending}
                onClick={() =>
                  createOperatorPayment.mutate({
                    operator_id: operatorId,
                    amount: Number(payoutAmount),
                    comment: payoutComment,
                  })
                }
              >
                To'lovni saqlash
              </Button>
              {createOperatorPayment.isSuccess ? (
                <Alert type="success" showIcon message="To'lov qayd qilindi" />
              ) : null}
              {createOperatorPayment.isError ? (
                <Alert type="error" showIcon message="Xatolik yuz berdi" />
              ) : null}
            </Space>
          </Card>

          <Card title={<><Banknote size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Daromadlar</>}>
            <Table size="small" rowKey={(_, i) => String(i)} pagination={false} loading={earningsQuery.isLoading} columns={earningColumns} dataSource={asRows(earningsQuery.data)} />
          </Card>

          <Card title="To'lovlar tarixi">
            <Table size="small" rowKey={(_, i) => String(i)} pagination={false} loading={payoutsQuery.isLoading} columns={payoutColumns} dataSource={asRows(payoutsQuery.data)} />
          </Card>
        </Space>
      ) : null}
    </div>
  );
};

export default memo(FinanceOperatorsPage);
