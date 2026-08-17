import { memo, useState } from "react";
import { Alert, Button, Card, Empty, Input, Space, Table, Tag, Typography } from "antd";
import { ArrowRightLeft, Landmark, Search, Store, Truck } from "lucide-react";
import { useOrdersCoverage } from "../../entities/orders/ordersCoverage";

const { Title, Text } = Typography;

/**
 * Settlement slice — the COD money flow courier → branch → HQ → market
 * (FIFO per order, guide §7). Each leg posts a lump sum; the backend allocates
 * it oldest-first across that party's outstanding orders and returns the
 * per-order allocation. This screen drives the three legs + the per-order
 * settlement-state lookup, all via `useOrdersCoverage()`.
 */

// The backend FIFO-settlement legs return the response envelope
// { statusCode, message, data: { settled_order_ids, allocated, leftover } }.
// (Per-order amounts are not returned — only which orders were settled, the
// total allocated, and the unallocated remainder.) Previously this screen read
// `result.allocations` / `result.remaining`, which never exist, so it always
// showed "Qoldiq: 0 · 0 ta buyurtma" and hid un-applied cash. (Audit P1-1.)
interface SettlementBody {
  settled_order_ids?: string[];
  allocated?: number;
  leftover?: number;
}

interface SettlementResult extends SettlementBody {
  data?: SettlementBody;
}

const fmt = (n: number) => Number(n || 0).toLocaleString("uz-UZ");

const settledOrderColumns = [
  { title: "Hisob-kitob qilingan buyurtma", dataIndex: "order_id", key: "order_id" },
];

const AllocationResult = ({ result }: { result?: SettlementResult }) => {
  if (!result) return null;
  // Tolerate both the wrapped envelope and an already-unwrapped body.
  const body: SettlementBody = result.data ?? result;
  const settledIds = body.settled_order_ids ?? [];
  const allocated = body.allocated ?? 0;
  const leftover = body.leftover ?? 0;
  const rows = settledIds.map((id) => ({ order_id: id }));
  return (
    <div style={{ marginTop: 12 }}>
      <Alert
        type="success"
        showIcon
        message="Hisob-kitob qabul qilindi"
        description={
          <>
            Taqsimlandi: <b>{fmt(allocated)} so'm</b> · {settledIds.length} ta buyurtma
            {leftover > 0 ? (
              <>
                {" · "}
                <Tag color="orange">Qoldiq: {fmt(leftover)} so'm</Tag>
              </>
            ) : (
              " · Qoldiq: 0 so'm"
            )}
          </>
        }
        style={{ marginBottom: 8 }}
      />
      {rows.length ? (
        <Table
          size="small"
          rowKey="order_id"
          pagination={false}
          columns={settledOrderColumns}
          dataSource={rows}
          scroll={{ x: "max-content" }}
        />
      ) : null}
    </div>
  );
};

const SettlementPage = () => {
  const {
    settlementCourierToBranch,
    settlementBranchToHq,
    settlementHqToMarket,
    useGetSettlementState,
  } = useOrdersCoverage();

  // ── Leg 1: courier → branch ────────────────────────────────────────────────
  const [courierId, setCourierId] = useState("");
  const [c2bBranchId, setC2bBranchId] = useState("");
  const [c2bAmount, setC2bAmount] = useState("");

  // ── Leg 2: branch → HQ ──────────────────────────────────────────────────────
  const [b2hBranchId, setB2hBranchId] = useState("");
  const [b2hAmount, setB2hAmount] = useState("");

  // ── Leg 3: HQ → market ──────────────────────────────────────────────────────
  const [marketId, setMarketId] = useState("");
  const [h2mAmount, setH2mAmount] = useState("");

  // ── Per-order settlement state lookup ────────────────────────────────────────
  const [lookupId, setLookupId] = useState("");
  const [activeLookupId, setActiveLookupId] = useState("");
  const settlementState = useGetSettlementState(activeLookupId, !!activeLookupId);

  return (
    <div className="mx-auto w-full max-w-[920px] px-4 pt-4 pb-28 md:pb-4">
      <Title level={3}>
        <ArrowRightLeft size={20} style={{ verticalAlign: -3, marginRight: 8 }} />
        Hisob-kitob (COD settlement)
      </Title>
      <Text type="secondary">
        Naqd pul oqimi: kuryer → filial → HQ → market. Har to'lov lump-sum, backend
        uni eng eski buyurtmadan boshlab (FIFO) taqsimlaydi.
      </Text>

      <Space direction="vertical" size="large" style={{ display: "flex", marginTop: 20 }}>
        {/* Leg 1 */}
        <Card title={<><Truck size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Kuryer → Filial</>}>
          <Space direction="vertical" style={{ display: "flex" }}>
            <Input aria-label="c2b-courier" placeholder="Kuryer ID" value={courierId} onChange={(e) => setCourierId(e.target.value)} />
            <Input aria-label="c2b-branch" placeholder="Filial ID" value={c2bBranchId} onChange={(e) => setC2bBranchId(e.target.value)} />
            <Input aria-label="c2b-amount" placeholder="Summa (so'm)" value={c2bAmount} onChange={(e) => setC2bAmount(e.target.value)} />
            <Button
              type="primary"
              loading={settlementCourierToBranch.isPending}
              onClick={() =>
                settlementCourierToBranch.mutate({
                  courier_id: courierId,
                  branch_id: c2bBranchId,
                  amount: Number(c2bAmount),
                })
              }
            >
              Hisob-kitobni yuborish
            </Button>
            {settlementCourierToBranch.isError ? (
              <Alert type="error" showIcon message="Xatolik yuz berdi" />
            ) : null}
            <AllocationResult result={settlementCourierToBranch.data as SettlementResult | undefined} />
          </Space>
        </Card>

        {/* Leg 2 */}
        <Card title={<><Landmark size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Filial → HQ</>}>
          <Space direction="vertical" style={{ display: "flex" }}>
            <Input aria-label="b2h-branch" placeholder="Filial ID" value={b2hBranchId} onChange={(e) => setB2hBranchId(e.target.value)} />
            <Input aria-label="b2h-amount" placeholder="Summa (so'm)" value={b2hAmount} onChange={(e) => setB2hAmount(e.target.value)} />
            <Button
              type="primary"
              loading={settlementBranchToHq.isPending}
              onClick={() =>
                settlementBranchToHq.mutate({
                  branch_id: b2hBranchId,
                  amount: Number(b2hAmount),
                })
              }
            >
              Hisob-kitobni yuborish
            </Button>
            <AllocationResult result={settlementBranchToHq.data as SettlementResult | undefined} />
          </Space>
        </Card>

        {/* Leg 3 */}
        <Card title={<><Store size={16} style={{ verticalAlign: -3, marginRight: 6 }} />HQ → Market</>}>
          <Space direction="vertical" style={{ display: "flex" }}>
            <Input aria-label="h2m-market" placeholder="Market ID" value={marketId} onChange={(e) => setMarketId(e.target.value)} />
            <Input aria-label="h2m-amount" placeholder="Summa (so'm)" value={h2mAmount} onChange={(e) => setH2mAmount(e.target.value)} />
            <Button
              type="primary"
              loading={settlementHqToMarket.isPending}
              onClick={() =>
                settlementHqToMarket.mutate({
                  market_id: marketId,
                  amount: Number(h2mAmount),
                })
              }
            >
              Hisob-kitobni yuborish
            </Button>
            <AllocationResult result={settlementHqToMarket.data as SettlementResult | undefined} />
          </Space>
        </Card>

        {/* Per-order settlement state */}
        <Card title={<><Search size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Buyurtma hisob-kitob holati</>}>
          <Space.Compact style={{ width: "100%" }}>
            <Input aria-label="lookup-order" placeholder="Buyurtma ID" value={lookupId} onChange={(e) => setLookupId(e.target.value)} />
            <Button type="primary" onClick={() => setActiveLookupId(lookupId)}>
              Tekshirish
            </Button>
          </Space.Compact>
          {settlementState.isLoading ? (
            <Text type="secondary">Yuklanmoqda…</Text>
          ) : settlementState.data ? (
            <pre style={{ marginTop: 12, background: "#f6f8fa", padding: 12, borderRadius: 6, maxWidth: "100%", overflowX: "auto" }}>
              {JSON.stringify(settlementState.data, null, 2)}
            </pre>
          ) : activeLookupId ? (
            <Empty description="Ma'lumot yo'q" style={{ marginTop: 12 }} />
          ) : null}
        </Card>
      </Space>
    </div>
  );
};

export default memo(SettlementPage);
