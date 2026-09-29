import { memo, useState, type ReactNode } from "react";
import { Alert, Button, Card, Empty, Input, Popconfirm, Space, Table, Tag, Typography } from "antd";
import type { UseMutationResult } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { ArrowRightLeft, Landmark, Search, Store, Truck } from "lucide-react";
import { useOrdersCoverage, type SettlementLegRequest } from "../../entities/orders/ordersCoverage";
import { getBackendErrorMessage } from "../../shared/lib/backendError";

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

/** "1 250 000" / "1250000" → 1250000; bo'sh yoki son emas → NaN. */
const parseAmount = (raw: string) => {
  const cleaned = raw.replace(/[\s,]/g, "");
  return cleaned === "" ? Number.NaN : Number(cleaned);
};

const newIdempotencyKey = () => crypto.randomUUID();

type LegField = { key: string; ariaLabel: string; placeholder: string };

interface SettlementLegProps {
  title: ReactNode;
  fields: LegField[];
  amountAriaLabel: string;
  /** Tasdiq matnidagi qabul qiluvchi, masalan "Filial #12". */
  recipient: (values: Record<string, string>) => string;
  mutation: UseMutationResult<unknown, Error, SettlementLegRequest>;
}

/**
 * BITTA HISOB-KITOB OYOG'I (5hBeDuyn):
 *  - ID lar bo'sh bo'lmasa va summa > 0 bo'lsagina tugma faol;
 *  - yuborishdan oldin summa va qabul qiluvchi bilan tasdiq (Popconfirm);
 *  - xato — server sababi bilan (ilgari 2 va 3-oyoqda umuman ko'rinmasdi);
 *  - javobsiz/504 — "natija noma'lum, qayta yubormang";
 *  - idempotentlik kaliti forma ochilganda bir marta, muvaffaqiyatdan keyin yangilanadi.
 */
const SettlementLeg = ({ title, fields, amountAriaLabel, recipient, mutation }: SettlementLegProps) => {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, ""])));
  const [amountRaw, setAmountRaw] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const amount = parseAmount(amountRaw);
  const idsFilled = fields.every((field) => values[field.key].trim() !== "");
  const isValid = idsFilled && Number.isFinite(amount) && amount > 0;

  const error = mutation.error as AxiosError | null;
  const status = error?.response?.status;
  const isUnknownOutcome = mutation.isError && (!status || status >= 502);

  const submit = () => {
    if (!isValid || mutation.isPending) return;
    const data = { ...Object.fromEntries(fields.map((f) => [f.key, values[f.key].trim()])), amount };
    mutation.mutate(
      { data, idempotencyKey },
      { onSuccess: () => setIdempotencyKey(newIdempotencyKey()) },
    );
  };

  return (
    <Card title={title}>
      <Space direction="vertical" style={{ display: "flex" }}>
        {fields.map((field) => (
          <Input
            key={field.key}
            aria-label={field.ariaLabel}
            placeholder={field.placeholder}
            value={values[field.key]}
            onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
          />
        ))}
        <Input
          aria-label={amountAriaLabel}
          placeholder="Summa (so'm)"
          inputMode="numeric"
          value={amountRaw}
          status={amountRaw !== "" && !(Number.isFinite(amount) && amount > 0) ? "error" : undefined}
          onChange={(e) => setAmountRaw(e.target.value)}
        />
        <Popconfirm
          title="Hisob-kitobni tasdiqlang"
          description={`${fmt(amount)} so'm → ${recipient(values)}. Tasdiqlaysizmi?`}
          okText="Ha, yuborish"
          cancelText="Bekor qilish"
          onConfirm={submit}
          disabled={!isValid || mutation.isPending}
        >
          <Button type="primary" loading={mutation.isPending} disabled={!isValid}>
            Hisob-kitobni yuborish
          </Button>
        </Popconfirm>
        {mutation.isError ? (
          isUnknownOutcome ? (
            <Alert
              type="warning"
              showIcon
              title="Natija noma'lum — qayta yubormang"
              description="Server javob bermadi yoki kechikdi. Pul allaqachon taqsimlangan bo'lishi mumkin: avval pastdagi buyurtma hisob-kitob holatini tekshiring."
            />
          ) : (
            <Alert
              type="error"
              showIcon
              title="Hisob-kitob yuborilmadi"
              description={getBackendErrorMessage(mutation.error) ?? "Xatolik yuz berdi"}
            />
          )
        ) : null}
        <AllocationResult result={mutation.data as SettlementResult | undefined} />
      </Space>
    </Card>
  );
};

const SettlementPage = () => {
  const {
    settlementCourierToBranch,
    settlementBranchToHq,
    settlementHqToMarket,
    useGetSettlementState,
  } = useOrdersCoverage();

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
        <SettlementLeg
          title={<><Truck size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Kuryer → Filial</>}
          fields={[
            { key: "courier_id", ariaLabel: "c2b-courier", placeholder: "Kuryer ID" },
            { key: "branch_id", ariaLabel: "c2b-branch", placeholder: "Filial ID" },
          ]}
          amountAriaLabel="c2b-amount"
          recipient={(v) => `Kuryer #${v.courier_id.trim()} → Filial #${v.branch_id.trim()}`}
          mutation={settlementCourierToBranch}
        />

        <SettlementLeg
          title={<><Landmark size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Filial → HQ</>}
          fields={[{ key: "branch_id", ariaLabel: "b2h-branch", placeholder: "Filial ID" }]}
          amountAriaLabel="b2h-amount"
          recipient={(v) => `Filial #${v.branch_id.trim()} → HQ`}
          mutation={settlementBranchToHq}
        />

        <SettlementLeg
          title={<><Store size={16} style={{ verticalAlign: -3, marginRight: 6 }} />HQ → Market</>}
          fields={[{ key: "market_id", ariaLabel: "h2m-market", placeholder: "Market ID" }]}
          amountAriaLabel="h2m-amount"
          recipient={(v) => `Market #${v.market_id.trim()}`}
          mutation={settlementHqToMarket}
        />

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
