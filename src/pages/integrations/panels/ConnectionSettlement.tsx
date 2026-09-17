import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Statistic,
  Table,
  Tag,
  message,
} from "antd";
import { Banknote, CheckCircle2, Clock, Plus, Wallet, XCircle } from "lucide-react";
import {
  money,
  toAmount,
  useCreateRemittance,
  useReceivableBalance,
  useReceivables,
  type ReceivableRow,
} from "../../../entities/integrations/settlement";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import FilterPills from "../FilterPills";
import type { Connection } from "../useConnections";

/**
 * HISOB-KITOB — tashuvchi yig'gan pul va bizga qarzi.
 *
 * Shakl PCS `ElchiSettlementTab` dan: yuqorida "bu kassa emas" ogohlantirishi,
 * ostida qoldiq kartasi (`Statistic`), keyin qarz qatorlari jadvali va
 * "to'lov olindi" oynasi.
 *
 * ⚠️ FOYDALANUVCHI TALABI: "ikkala kassani solishtirish uchun". Aynan shu —
 * bir tomonda biz hisoblagan qarz, ikkinchi tomonda ular to'lagan summa.
 *
 * ⚠️ BU EKRAN KASSAGA YOZMAYDI. Backend ham shunday: "Reconciliation only —
 * does not post to a cashbox". Buni ekranda AYTISH shart, aks holda operator
 * pulni ikki marta kiritganini bilmay qoladi.
 */

const STATUS_TAG: Record<string, { color: string; labelKey: string }> = {
  pending: { color: "gold", labelKey: "settlePending" },
  settled: { color: "green", labelKey: "settleSettled" },
  cancelled: { color: "default", labelKey: "settleCancelled" },
};

const ConnectionSettlement = ({ connection }: { connection: Connection }) => {
  const { t } = useTranslation("integrations");
  /**
   * ⚠️ HISOB-KITOB FAQAT CHIQUVCHI ULANISHDA.
   *
   * Qarz daftari (`provider_receivable`) tashuvchi uchun yuritiladi: u pulni
   * MIJOZDAN yig'adi va bizga qarz bo'lib turadi. Hamkorda yo'nalish
   * TESKARI — pulni biz yig'amiz va ularga hisob beramiz, daftar esa
   * ULARNING tomonida. Elchi'da hamkor uchun bunday jadval YO'Q, shuning
   * uchun soxta raqam ko'rsatmaymiz.
   */
  if (connection.kind === "partner") {
    return (
      <Alert
        type="info"
        showIcon
        message={t("stlNoLedger")}
        description={
          <div className="space-y-1 text-sm">
            <p className="m-0">
              {t("stlPartnerP1a")} <b>{t("stlPartnerP1b")}</b> {t("stlPartnerP1c")} (
              <code>cod_collected</code>) {t("stlPartnerP1d")}
            </p>
            <p className="m-0">{t("stlPartnerP2")}</p>
          </div>
        }
      />
    );
  }

  return <CarrierSettlement connection={connection} />;
};

const CarrierSettlement = ({ connection }: { connection: Connection }) => {
  const { t } = useTranslation("integrations");
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [payOpen, setPayOpen] = useState(false);
  const [form] = Form.useForm<{
    amount: number;
    reference?: string;
    note?: string;
  }>();

  const balance = useReceivableBalance(connection.id);
  const list = useReceivables({
    integrationId: connection.id,
    status,
    page,
    limit: 20,
  });
  const createRemittance = useCreateRemittance();

  const rows = list.data?.items ?? [];
  const outstanding = balance.data?.outstanding_amount ?? 0;

  const submitPayment = async () => {
    try {
      const values = await form.validateFields();
      await createRemittance.mutateAsync({
        integrationId: connection.id,
        amount: Number(values.amount),
        reference: values.reference?.trim() || undefined,
        note: values.note?.trim() || undefined,
      });
      message.success(t("stlPaid"));
      setPayOpen(false);
      form.resetFields();
      void balance.refetch();
      void list.refetch();
    } catch (error) {
      // `validateFields` ham shu yerga tushadi — u o'z xatosini maydonda
      // ko'rsatadi, shuning uchun faqat server xatosini xabar qilamiz.
      const msg = getBackendErrorMessage(error);
      if (msg) message.error(msg);
    }
  };

  return (
    <div className="space-y-4">
      <Alert
        type="info"
        showIcon
        message={t("stlNotCashbox")}
        description={t("stlNotCashboxDesc")}
      />

      {/* ═══════ QOLDIQ ═══════ */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <Wallet className="h-4 w-4" /> {t("stlBalance")}
          </span>
        }
        extra={
          <Button
            type="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setPayOpen(true)}
          >
            To'lov olindi
          </Button>
        }
        loading={balance.isLoading}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Statistic
            title={t("stlOutstanding")}
            value={money(outstanding)}
            valueStyle={{ color: outstanding > 0 ? "#ea580c" : "#16a34a" }}
          />
          <Statistic
            title={t("stlOutstandingCount")}
            value={balance.data?.outstanding_count ?? 0}
            suffix={t("stlCountSuffix")}
          />
        </div>

        <p className="m-0 mt-3 text-xs text-gray-500 dark:text-gray-400">
          {t("stlBalanceNoteA")} <b>{t("stlBalanceNoteBold")}</b> {t("stlBalanceNoteB")}
        </p>
      </Card>

      {/* ═══════ QARZ QATORLARI ═══════ */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <Banknote className="h-4 w-4" /> {t("stlRows")}
          </span>
        }
      >
        <FilterPills
          value={status}
          onChange={(v) => {
            setStatus(v);
            // Filtr o'zgarganda sahifani boshiga qaytaramiz.
            setPage(1);
          }}
          options={[
            {
              value: "pending",
              label: t("settlePending"),
              icon: <Clock className="h-3.5 w-3.5" />,
              activeClass: "bg-amber-600 text-white border-amber-600",
            },
            {
              value: "settled",
              label: t("settleSettled"),
              icon: <CheckCircle2 className="h-3.5 w-3.5" />,
              activeClass: "bg-green-600 text-white border-green-600",
            },
            {
              value: "cancelled",
              label: t("settleCancelled"),
              icon: <XCircle className="h-3.5 w-3.5" />,
            },
            { value: "all", label: t("filterAll") },
          ]}
        />

        <Table<ReceivableRow>
          className="mt-3"
          rowKey={(r) => String(r.id)}
          size="small"
          scroll={{ x: 700 }}
          loading={list.isLoading}
          dataSource={rows}
          pagination={{
            current: page,
            pageSize: list.data?.pagination.limit ?? 20,
            total: list.data?.pagination.total ?? rows.length,
            showSizeChanger: false,
            onChange: setPage,
          }}
          /* Jami — jadval ostida: operator sahifadagi summani ko'rib turadi. */
          summary={(data) => {
            const sum = data.reduce((acc, r) => acc + toAmount(r.amount), 0);
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={2}>
                  <b>{t("stlPageTotal")}</b>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2}>
                  <b>{money(sum)}</b>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} colSpan={2} />
              </Table.Summary.Row>
            );
          }}
          columns={[
            {
              title: t("colOrder"),
              width: 120,
              render: (_: unknown, r) => <span className="font-mono text-xs">{r.order_id}</span>,
            },
            {
              title: t("colExternalNumber"),
              width: 150,
              render: (_: unknown, r) => (
                <span className="font-mono text-xs">{r.external_ref ?? "—"}</span>
              ),
            },
            {
              title: t("colAmount"),
              width: 140,
              align: "right" as const,
              render: (_: unknown, r) => (
                <span className="tabular-nums">{money(toAmount(r.amount))}</span>
              ),
            },
            {
              title: t("colStatus"),
              width: 130,
              render: (_: unknown, r) => {
                /* ⚠️ `tag`, `t` EMAS — i18n funksiyasini soya qilmasin. */
                const tag = STATUS_TAG[r.status];
                return (
                  <Tag color={tag?.color ?? "default"}>{tag ? t(tag.labelKey) : r.status}</Tag>
                );
              },
            },
            {
              title: t("colClosed"),
              render: (_: unknown, r) => (
                <span className="font-mono text-xs">
                  {r.settled_at ? new Date(r.settled_at).toLocaleString("uz-UZ") : "—"}
                </span>
              ),
            },
          ]}
        />
      </Card>

      {/* ═══════ TO'LOV OYNASI ═══════ */}
      <Modal
        title={t("stlPayTitle")}
        open={payOpen}
        onCancel={() => setPayOpen(false)}
        onOk={submitPayment}
        okText={t("stlPayOk")}
        cancelText={t("common:cancel")}
        confirmLoading={createRemittance.isPending}
        destroyOnClose
      >
        <Alert
          className="mb-3"
          type="warning"
          showIcon
          message={t("stlPayWarn")}
          description={t("stlPayWarnDesc")}
        />
        <Form form={form} layout="vertical">
          <Form.Item
            name="amount"
            label={t("stlAmount")}
            rules={[
              { required: true, message: t("stlAmountRequired") },
              {
                type: "number",
                min: 1,
                message: t("stlAmountPositive"),
              },
            ]}
          >
            {/*
              `InputNumber<number>` — generik ATAYLAB ko'rsatilgan: `min={1}`
              bilan antd qiymat turini `1` literaliga toraytirib yuboradi va
              `parser` tipi mos kelmaydi.
            */}
            <InputNumber<number>
              className="w-full"
              min={1}
              step={1000}
              /* Minglik ajratgich — katta summada nol sanash xatoga olib keladi. */
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}
              parser={(v) => Number((v ?? "").replace(/\s/g, ""))}
              placeholder="1 500 000"
            />
          </Form.Item>

          <Form.Item name="reference" label={t("stlReference")} extra={t("stlReferenceHint")}>
            <Input placeholder="TXN-2026-0912" />
          </Form.Item>

          <Form.Item name="note" label={t("stlNote")}>
            <Input.TextArea rows={2} placeholder={t("stlNotePlaceholder")} />
          </Form.Item>
        </Form>

        <p className="m-0 text-xs text-gray-500 dark:text-gray-400">
          {t("stlOldestFirstA")} <b>{t("stlOldestFirstBold")}</b> {t("stlOldestFirstB")}{" "}
          <b>{money(outstanding)}</b>
        </p>
      </Modal>
    </div>
  );
};

export default ConnectionSettlement;
