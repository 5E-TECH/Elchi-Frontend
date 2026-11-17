// dizayn-v2: superadmin-ops-branches
import { memo } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useBranchCoverage } from "../../entities/branch/branchCoverage";
import { extractArray } from "../../entities/branch";
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  QueryBoundary,
  type DataTableColumn,
} from "../../shared/ui/primitives";
import { OpsIntro, OpsToolPage } from "../ops/ui/OpsToolPage";
import { useOpsErrorText } from "../ops/lib/opsErrorText";

/**
 * «Filiallar — operatsiyalar» (maket `superadmin-ops-branches`), `/batches` ichida, faqat superadmin (F2NzXpMv):
 * yangi buyurtmali filiallar (`GET branches/new-orders`, konvert `{ statusCode, message, data: [...] }`).
 *
 * oP02jE2P (2026-11-17): maketdagi «Paketni bekor qilish» kartasi (qo'lda paket raqami + sabab) OLIB TASHLANDI —
 * raqamda adashib boshqa paket bekor qilinmasin; bekor qilish endi faqat paket sahifasida (`/batches/:id`, faqat yangi
 * paket). Jadval qoldi (ega 2026-10-31 da shu yerga ko'chirgan), qator — filial sahifasiga (`/branches/:id`) havola.
 */

type BranchWithNewOrders = { id: string; name: string; new_orders_count: number };

const branchHref = (row: BranchWithNewOrders) => `/branches/${encodeURIComponent(String(row.id))}`;

const BranchOpsPage = () => {
  const { t } = useTranslation("ops");
  const navigate = useNavigate();
  const { useGetNewOrders } = useBranchCoverage();
  // Rad etilgan so'rov — o'z matnimiz (backend xabari ko'rsatilmaydi, LJt0G1y1).
  const errorText = useOpsErrorText();

  const newOrders = useGetNewOrders(undefined, { silentError: true });
  // Javob konverti `{ statusCode, message, data: [...] }` — massiv `data` ichida.
  const rows = extractArray<BranchWithNewOrders>(newOrders.data);

  const count = (value: number) => t("common.count", { count: value });

  const columns: DataTableColumn<BranchWithNewOrders>[] = [
    {
      id: "id",
      header: t("branches.list.id"),
      className: "w-[72px]",
      cell: (row) => <span className="text-text-muted">{row.id}</span>,
    },
    {
      id: "name",
      header: t("branches.list.name"),
      cell: (row) => (
        <Link to={branchHref(row)} className="font-semibold text-text hover:text-action-fg hover:underline">
          {row.name}
        </Link>
      ),
    },
    {
      id: "new_orders_count",
      header: t("branches.list.newOrders"),
      align: "end",
      cell: (row) => <span className="font-semibold">{count(Number(row.new_orders_count) || 0)}</span>,
    },
  ];

  return (
    <OpsToolPage tabKey="branches" embedded>
      <OpsIntro title={t("branches.intro.title")} description={t("branches.intro.description")} />

      <Card
        padding="none"
        title={t("branches.list.title")}
        actions={newOrders.data !== undefined && !newOrders.isError ? <Badge>{count(rows.length)}</Badge> : null}
        className="min-w-0"
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
              onRowClick={(row) => navigate(branchHref(row))}
              renderCard={(row) => (
                <Link
                  to={branchHref(row)}
                  aria-label={t("branches.list.open", { name: row.name })}
                  className="flex min-h-14 min-w-0 items-center gap-3 px-4 py-3 text-text"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-semibold">{row.name}</span>
                    <span className="text-[13px] text-text-muted">{t("common.idValue", { id: row.id })}</span>
                  </span>
                  <span className="whitespace-nowrap font-semibold">{count(Number(row.new_orders_count) || 0)}</span>
                  <ChevronRight aria-hidden="true" size={18} strokeWidth={2} className="shrink-0 text-text-subtle" />
                </Link>
              )}
            />
          )}
        </QueryBoundary>
      </Card>
    </OpsToolPage>
  );
};

export default memo(BranchOpsPage);
