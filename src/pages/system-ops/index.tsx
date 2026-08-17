import { memo, useState } from "react";
import { Button, Card, Input, Space, Tag, Typography } from "antd";
import { useMiscCoverage } from "../../entities/coverage/miscCoverage";

const { Title, Text } = Typography;

/**
 * System-ops page — analytics KPI + liveness health indicator + scan-by-token lookup.
 * Uses `useMiscCoverage()` hooks; all three queries called unconditionally at top level
 * with enabled flags so React hook rules are satisfied.
 */

const SystemOpsPage = () => {
  const { useGetAnalyticsKpi, useGetHealthLiveness, useGetScanByToken } = useMiscCoverage();

  // ── Scan lookup ───────────────────────────────────────────────────────────
  const [scanInput, setScanInput] = useState("");
  const [activeToken, setActiveToken] = useState("");

  // All three queries unconditional at top level
  const kpiQuery = useGetAnalyticsKpi();
  const healthQuery = useGetHealthLiveness();
  const scanQuery = useGetScanByToken(activeToken, !!activeToken);

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 pt-4 pb-28 md:pb-4">
      <Title level={3}>Tizim — analitika va xizmatlar</Title>
      <Text type="secondary">
        Tizim holati, analitika ko'rsatkichlari va QR-token tekshirish oynasi.
      </Text>

      <Space direction="vertical" size="large" style={{ display: "flex", marginTop: 20 }}>
        {/* Analytics KPI */}
        <Card title="Analitika KPI">
          {kpiQuery.isLoading ? (
            <Text type="secondary">Yuklanmoqda…</Text>
          ) : kpiQuery.data !== undefined ? (
            <pre style={{ background: "#f6f8fa", padding: 12, borderRadius: 6, margin: 0, maxWidth: "100%", overflowX: "auto" }}>
              {JSON.stringify(kpiQuery.data, null, 2)}
            </pre>
          ) : (
            <Text type="secondary">Ma'lumot yo'q</Text>
          )}
        </Card>

        {/* Health liveness */}
        <Card title="Tizim holati (liveness)">
          {healthQuery.isLoading ? (
            <Text type="secondary">Yuklanmoqda…</Text>
          ) : healthQuery.isError ? (
            <Tag color="red">Xatolik</Tag>
          ) : (
            <Tag color="green">Ishlayapti</Tag>
          )}
        </Card>

        {/* Scan by token */}
        <Card title="Token orqali tekshirish">
          <Space.Compact style={{ width: "100%" }}>
            <Input
              aria-label="scan-token"
              placeholder="Token kiriting"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
            />
            <Button type="primary" onClick={() => setActiveToken(scanInput)}>
              Tekshirish
            </Button>
          </Space.Compact>
          {scanQuery.isLoading && activeToken ? (
            <Text type="secondary" style={{ marginTop: 8, display: "block" }}>
              Yuklanmoqda…
            </Text>
          ) : scanQuery.data !== undefined ? (
            <pre style={{ marginTop: 12, background: "#f6f8fa", padding: 12, borderRadius: 6, maxWidth: "100%", overflowX: "auto" }}>
              {JSON.stringify(scanQuery.data, null, 2)}
            </pre>
          ) : null}
        </Card>
      </Space>
    </div>
  );
};

export default memo(SystemOpsPage);
