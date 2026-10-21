// dizayn-v2: superadmin-ops-branches
import { memo, useState, type FormEvent } from "react";
import { CircleX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useBranchCoverage } from "../../entities/branch/branchCoverage";
import { extractArray } from "../../entities/branch";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  QueryBoundary,
  TextInput,
  useConfirm,
  type DataTableColumn,
} from "../../shared/ui/primitives";
import { OpsAlert, OpsIntro, OpsToolPage } from "../ops/ui/OpsToolPage";
import { useOpsErrorText } from "../ops/lib/opsErrorText";

/**
 * OPS → «Filiallar» (maket `superadmin-ops-branches`): yangi buyurtmali filiallar (`GET branches/new-orders`,
 * konvert `{ statusCode, message, data: [...] }`) va paketni bekor qilish (`POST transfer-batches/:id/cancel`
 * — `{ reason }`, faqat tasdiqdan keyin; sabab kamida 10 belgi — backend shunday rad etadi).
 */

// Backend (branch-service) rejects a cancel without a reason of at least 10 chars.
const MIN_REASON_LENGTH = 10;

type BranchWithNewOrders = { id: string; name: string; new_orders_count: number };

const BranchOpsPage = ({ embedded = false }: { embedded?: boolean }) => {
  const { t } = useTranslation("ops");
  const { useGetNewOrders, cancelBatch } = useBranchCoverage();
  const confirm = useConfirm();
  // Rad etilgan so'rov — o'z matnimiz (backend xabari ko'rsatilmaydi, LJt0G1y1).
  const errorText = useOpsErrorText();

  const newOrders = useGetNewOrders(undefined, { silentError: true });
  // Javob konverti `{ statusCode, message, data: [...] }` — massiv `data` ichida.
  const rows = extractArray<BranchWithNewOrders>(newOrders.data);

  const [batchId, setBatchId] = useState("");
  const [reason, setReason] = useState("");

  const trimmedBatchId = batchId.trim();
  const trimmedReason = reason.trim();
  const reasonTooShort = trimmedReason.length > 0 && trimmedReason.length < MIN_REASON_LENGTH;
  const canCancel = trimmedBatchId.length > 0 && trimmedReason.length >= MIN_REASON_LENGTH;

  const count = (value: number) => t("common.count", { count: value });

  const columns: DataTableColumn<BranchWithNewOrders>[] = [
    {
      id: "id",
      header: t("branches.list.id"),
      className: "w-[72px]",
      cell: (row) => <span className="text-text-muted">{row.id}</span>,
    },
    { id: "name", header: t("branches.list.name"), cell: (row) => <span className="font-semibold">{row.name}</span> },
    {
      id: "new_orders_count",
      header: t("branches.list.newOrders"),
      align: "end",
      cell: (row) => <span className="font-semibold">{count(Number(row.new_orders_count) || 0)}</span>,
    },
  ];

  const handleCancel = async (event: FormEvent) => {
    event.preventDefault();
    if (!canCancel || cancelBatch.isPending) return;
    const ok = await confirm({
      tone: "danger",
      title: t("branches.cancel.confirmTitle"),
      description: t("branches.cancel.confirmDescription"),
      confirmLabel: t("branches.cancel.confirmLabel"),
      cancelLabel: t("branches.cancel.cancelLabel"),
      icon: CircleX,
      confirmIcon: CircleX,
    });
    // Natija (muvaffaqiyat / xato) quyidagi ogohlantirishlarda ko'rinadi.
    if (ok) cancelBatch.mutate({ id: trimmedBatchId, data: { reason: trimmedReason } });
  };

  return (
    <OpsToolPage tabKey="branches" embedded={embedded}>
      <OpsIntro title={t("branches.intro.title")} description={t("branches.intro.description")} />

      <div className="flex flex-wrap items-start gap-6 max-md:gap-4">
        <Card
          padding="none"
          title={t("branches.list.title")}
          actions={newOrders.data !== undefined && !newOrders.isError ? <Badge>{count(rows.length)}</Badge> : null}
          className="min-w-0 flex-[3_1_440px]"
        >
          <QueryBoundary
            query={newOrders}
            skeleton="table"
            isEmpty={() => rows.length === 0}
            empty={<EmptyState title={t("branches.list.empty")} description={t("branches.list.emptyHint")} />}
            error={(error, retry) => (
              <ErrorState
                error={error}
                title={t("branches.list.loadError")}
                description={errorText(error)}
                retryLabel={t("common.retry")}
                onRetry={retry}
              />
            )}
          >
            {() => (
              <DataTable
                rows={rows}
                columns={columns}
                getRowKey={(row) => String(row.id)}
                label={t("branches.list.title")}
                renderCard={(row) => (
                  <div className="flex min-w-0 items-center gap-3 px-4 py-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-semibold">{row.name}</span>
                      <span className="text-[13px] text-text-muted">{t("common.idValue", { id: row.id })}</span>
                    </div>
                    <span className="whitespace-nowrap font-semibold">{count(Number(row.new_orders_count) || 0)}</span>
                  </div>
                )}
              />
            )}
          </QueryBoundary>
        </Card>

        <Card
          title={t("branches.cancel.title")}
          description={t("branches.cancel.description")}
          className="min-w-0 flex-[2_1_340px]"
        >
          <form onSubmit={handleCancel} noValidate className="flex flex-col gap-4">
            <Field label={t("branches.cancel.batchId")} required>
              <div className="relative flex items-center">
                <span aria-hidden="true" className="pointer-events-none absolute left-3 z-10 text-text-muted">
                  {t("branches.cancel.batchPrefix")}
                </span>
                <TextInput
                  inputMode="numeric"
                  value={batchId}
                  onValueChange={setBatchId}
                  className="w-full"
                  inputClassName="pl-7"
                />
              </div>
            </Field>
            <Field
              label={t("branches.cancel.reason")}
              required
              hint={
                reasonTooShort
                  ? undefined
                  : t("branches.cancel.reasonHint", { count: trimmedReason.length, min: MIN_REASON_LENGTH })
              }
              error={
                reasonTooShort
                  ? t("branches.cancel.reasonTooShort", { count: trimmedReason.length, min: MIN_REASON_LENGTH })
                  : undefined
              }
            >
              <TextInput multiline rows={3} value={reason} onValueChange={setReason} className="min-h-24" />
            </Field>
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="danger-soft"
                leftIcon={CircleX}
                disabled={!canCancel}
                loading={cancelBatch.isPending}
                className="max-md:w-full"
              >
                {t("branches.cancel.submit")}
              </Button>
            </div>

            {cancelBatch.isSuccess ? <OpsAlert tone="success" title={t("branches.cancel.success")} /> : null}
            {cancelBatch.isError ? (
              <OpsAlert tone="danger" title={t("branches.cancel.error")}>
                {errorText(cancelBatch.error, { action: true })}
              </OpsAlert>
            ) : null}
          </form>
        </Card>
      </div>
    </OpsToolPage>
  );
};

export default memo(BranchOpsPage);
