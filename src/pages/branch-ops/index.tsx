import { memo, useState } from "react";
import { Alert, Button, Input, Space, Table, Typography } from "antd";
import { Ban } from "lucide-react";
import { useBranchCoverage } from "../../entities/branch/branchCoverage";
import { extractArray } from "../../entities/branch";
import { getBackendErrorMessage } from "../../shared/lib/backendError";
import { useConfirm } from "../../shared/ui/primitives";

const { Title, Text } = Typography;

// Backend (branch-service) rejects a cancel without a reason of at least 10 chars.
const MIN_REASON_LENGTH = 10;

type BranchWithNewOrders = { id: string; name: string; new_orders_count: number };

const columns = [
  { title: "ID", dataIndex: "id", key: "id" },
  { title: "Nomi", dataIndex: "name", key: "name" },
  { title: "Yangi buyurtmalar", dataIndex: "new_orders_count", key: "new_orders_count" },
];

const BranchOpsPage = () => {
  const { useGetNewOrders, cancelBatch } = useBranchCoverage();
  const confirm = useConfirm();

  const newOrders = useGetNewOrders();

  const [batchId, setBatchId] = useState("");
  const [reason, setReason] = useState("");

  const trimmedBatchId = batchId.trim();
  const trimmedReason = reason.trim();
  const reasonTooShort = trimmedReason.length > 0 && trimmedReason.length < MIN_REASON_LENGTH;
  const canCancel = trimmedBatchId.length > 0 && trimmedReason.length >= MIN_REASON_LENGTH;

  // Javob konverti `{ statusCode, message, data: [...] }` — massiv `data` ichida.
  const dataSource = extractArray<BranchWithNewOrders>(newOrders.data);

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

        <Space direction="vertical" style={{ display: "flex" }}>
          <Input
            aria-label="batch-id"
            placeholder="Partiya ID"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
          />
          <Input.TextArea
            aria-label="Bekor qilish sababi"
            placeholder={`Bekor qilish sababi (kamida ${MIN_REASON_LENGTH} ta belgi)`}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {reasonTooShort ? (
            <Text type="warning">
              Sabab kamida {MIN_REASON_LENGTH} ta belgidan iborat bo'lishi kerak (hozir{" "}
              {trimmedReason.length} ta)
            </Text>
          ) : null}
          <Button
            type="primary"
            danger
            disabled={!canCancel}
            loading={cancelBatch.isPending}
            onClick={async () => {
              const ok = await confirm({
                tone: "danger",
                title: "Partiyani bekor qilasizmi?",
                description: "Partiya va undagi barcha buyurtmalar bog'lanishdan chiqariladi",
                confirmLabel: "Partiyani bekor qilish",
                cancelLabel: "Orqaga", // asosiy amalning o'zi bekor qilish — «Orqaga» (tizim-feedback 06)
                icon: Ban,
                confirmIcon: Ban,
                irreversible: true,
              });
              // Natija (muvaffaqiyat / xato) quyidagi `Alert` larda ko'rinadi.
              if (ok) cancelBatch.mutate({ id: trimmedBatchId, data: { reason: trimmedReason } });
            }}
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

        {cancelBatch.isError ? (
          <Alert
            type="error"
            showIcon
            message="Partiyani bekor qilib bo'lmadi"
            description={
              getBackendErrorMessage(cancelBatch.error) ?? "Noma'lum xatolik yuz berdi"
            }
          />
        ) : null}
      </Space>
    </div>
  );
};

export default memo(BranchOpsPage);
