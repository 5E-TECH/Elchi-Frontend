// dizayn-v2: superadmin-ops-integrations
import { memo, useState, type FormEvent } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIntegrationsCoverage } from "../../entities/integrations/integrationsCoverage";
import { getBackendErrorMessage } from "../../shared/lib/backendError";
import { formatDateTimeLocalized } from "../../shared/lib/formatDateTime";
import { formatMoneyLocalized } from "../../shared/lib/formatMoney";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  Pagination,
  QueryBoundary,
  StatusBadge,
  TextInput,
  type DataTableColumn,
  type Tone,
} from "../../shared/ui/primitives";
import { OpsAlert, OpsIntro, OpsToolPage } from "../ops/ui/OpsToolPage";

/**
 * OPS → «Integratsiyalar» (maket `superadmin-ops-integrations`): debitorlik qarzlari (`GET integrations/receivables`
 * — `{ data: { items, pagination } }`) va sinxronizatsiya (`POST integrations/:id/sync`).
 */

const PAGE_SIZE = 20;

type ReceivableRow = { key: string; id: string; amount: number; status: string };

const STATUS_TONE: Record<string, Tone> = { pending: "warning", settled: "neutral", cancelled: "danger" };

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/**
 * Backend `{ statusCode, data: { items, pagination } }` qaytaradi; massiv ham, `{ items }` ham qabul qilinadi
 * (massiv bo'lmagan obyekt jadvalga tushmasin).
 */
const readReceivables = (body: unknown): { rows: ReceivableRow[]; total: number } => {
  const root = asRecord(body);
  const data = asRecord(root.data);
  const items: unknown[] = Array.isArray(body)
    ? body
    : Array.isArray(data.items)
      ? data.items
      : Array.isArray(root.items)
        ? root.items
        : [];
  const pagination = asRecord(data.pagination ?? root.pagination);
  const rows = items.map((item, index) => {
    const record = asRecord(item);
    const id = record.id == null ? "" : String(record.id);
    return {
      key: id || `receivable-${index}`,
      id,
      amount: Number(record.amount) || 0,
      status: record.status == null ? "" : String(record.status).toLowerCase(),
    };
  });
  const total = Number(pagination.total);
  return { rows, total: Number.isFinite(total) && total > 0 ? total : rows.length };
};

const IntegrationsOpsPage = ({ embedded = false }: { embedded?: boolean }) => {
  const { t, i18n } = useTranslation("ops");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { useGetReceivables, sync } = useIntegrationsCoverage();

  const [page, setPage] = useState(1);
  const receivables = useGetReceivables({ page, limit: PAGE_SIZE });
  const { rows, total } = readReceivables(receivables.data);

  const [integrationId, setIntegrationId] = useState("");
  const [lastSync, setLastSync] = useState<{ id: string; at: Date } | null>(null);
  const trimmedId = integrationId.trim();

  const money = (value: number) => formatMoneyLocalized(value, { language });
  const statusLabel = (status: string) =>
    t(`integrations.receivables.statuses.${status}`, { defaultValue: status || "—" });
  const statusBadge = (row: ReceivableRow) => (
    <StatusBadge tone={STATUS_TONE[row.status] ?? "neutral"} label={statusLabel(row.status)} />
  );

  const columns: DataTableColumn<ReceivableRow>[] = [
    { id: "id", header: t("integrations.receivables.id"), cell: (row) => <span className="font-semibold">{row.id || "—"}</span> },
    {
      id: "amount",
      header: t("integrations.receivables.amount"),
      align: "end",
      cell: (row) => <span className="font-semibold">{money(row.amount)}</span>,
    },
    { id: "status", header: t("integrations.receivables.status"), className: "w-[40%]", cell: statusBadge },
  ];

  const runSync = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmedId || sync.isPending) return;
    setLastSync(null);
    sync.mutate({ id: trimmedId }, { onSuccess: () => setLastSync({ id: trimmedId, at: new Date() }) });
  };

  return (
    <OpsToolPage tabKey="integrations" embedded={embedded}>
      <OpsIntro title={t("integrations.intro.title")} description={t("integrations.intro.description")} />

      <div className="flex flex-wrap items-start gap-6 max-md:gap-4">
        <Card
          padding="none"
          title={t("integrations.receivables.title")}
          description={t("integrations.receivables.description")}
          actions={receivables.data !== undefined && !receivables.isError ? <Badge>{t("common.count", { count: total })}</Badge> : null}
          className="min-w-0 flex-[2_1_480px]"
          footer={
            total > PAGE_SIZE && !receivables.isError ? (
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                onPageChange={setPage}
                summary={(range) => t("integrations.receivables.summary", range)}
              />
            ) : undefined
          }
        >
          <QueryBoundary
            query={receivables}
            skeleton="table"
            isEmpty={() => rows.length === 0}
            empty={
              <EmptyState title={t("integrations.receivables.empty")} description={t("integrations.receivables.emptyHint")} />
            }
            error={(error, retry) => (
              <ErrorState
                error={error}
                title={t("integrations.receivables.loadError")}
                description={getBackendErrorMessage(error) ?? undefined}
                retryLabel={t("common.retry")}
                retrying={receivables.isFetching}
                onRetry={retry}
              />
            )}
          >
            {() => (
              <DataTable
                rows={rows}
                columns={columns}
                getRowKey={(row) => row.key}
                label={t("integrations.receivables.title")}
                renderCard={(row) => (
                  <div className="flex min-w-0 items-center gap-3 px-4 py-3">
                    <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                      <span className="font-semibold">{t("common.idValue", { id: row.id || "—" })}</span>
                      {statusBadge(row)}
                    </div>
                    <span className="whitespace-nowrap font-semibold">{money(row.amount)}</span>
                  </div>
                )}
              />
            )}
          </QueryBoundary>
        </Card>

        <Card
          title={t("integrations.sync.title")}
          description={t("integrations.sync.description")}
          className="min-w-0 flex-[1_1_320px]"
        >
          <form onSubmit={runSync} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-x-3 gap-y-4">
              <Field label={t("integrations.sync.label")} required className="min-w-0 flex-[3_1_220px]">
                <TextInput
                  inputMode="numeric"
                  value={integrationId}
                  onValueChange={setIntegrationId}
                  placeholder={t("integrations.sync.placeholder")}
                />
              </Field>
              <Button
                type="submit"
                leftIcon={RefreshCw}
                loading={sync.isPending}
                disabled={!trimmedId}
                className="flex-[1_1_180px]"
              >
                {t("integrations.sync.submit")}
              </Button>
            </div>
            {lastSync && sync.isSuccess ? (
              <OpsAlert tone="success" title={t("integrations.sync.success")}>
                {t("integrations.sync.successMeta", {
                  id: lastSync.id,
                  time: formatDateTimeLocalized(lastSync.at, { language }),
                })}
              </OpsAlert>
            ) : null}
            {sync.isError ? (
              <OpsAlert tone="danger" title={t("integrations.sync.error")}>
                {getBackendErrorMessage(sync.error)}
              </OpsAlert>
            ) : null}
          </form>
        </Card>
      </div>
    </OpsToolPage>
  );
};

export default memo(IntegrationsOpsPage);
