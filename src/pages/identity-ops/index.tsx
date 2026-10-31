// dizayn-v2: superadmin-ops-identity
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useIdentityCoverage } from "../../entities/identity";
import { toRows } from "../../shared/lib/toRows";
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  QueryBoundary,
  type DataTableColumn,
  type QueryLike,
} from "../../shared/ui/primitives";
import { OpsIntro, OpsToolPage } from "../ops/ui/OpsToolPage";
import { useOpsErrorText } from "../ops/lib/opsErrorText";

/**
 * OPS → «Xodimlar» (maket `superadmin-ops-identity`): adminlar, menejerlar, registratorlar ro'yxatlari
 * (`GET admins|managers|registrators` — konvert `{ data: { items } }`). «Market: buyurtma qo'shish» ruxsati — bitta
 * joyda, market profilida (`UserDetailView` → «Ruxsatlar», 941rmIn5): bu yerdagi ID bilan ruxsat berish kartasi olindi.
 */

type StaffRow = { key: string; id: string; name: string; email: string };

const toStaffRows = (payload: unknown): StaffRow[] =>
  toRows<Record<string, unknown>>(payload).map((item, index) => {
    const id = item.id == null ? "" : String(item.id);
    return {
      key: id || `staff-${index}`,
      id,
      name: item.name == null ? "" : String(item.name),
      email: item.email == null ? "" : String(item.email),
    };
  });

/** Ro'yxat jami: konvert `meta.total` / `pagination.total` (bo'lsa), aks holda qatorlar soni. */
const readTotal = (payload: unknown, fallback: number) => {
  const record = (payload ?? {}) as { data?: { meta?: { total?: unknown }; pagination?: { total?: unknown } } };
  const total = Number(record.data?.meta?.total ?? record.data?.pagination?.total);
  return Number.isFinite(total) && total > 0 ? total : fallback;
};

const StaffCard = ({ title, query }: { title: string; query: QueryLike<unknown> }) => {
  const { t } = useTranslation("ops");
  const errorText = useOpsErrorText();
  const rows = toStaffRows(query.data);
  const total = readTotal(query.data, rows.length);

  const columns: DataTableColumn<StaffRow>[] = [
    { id: "id", header: t("identity.lists.id"), cell: (row) => <span className="text-text-muted">{row.id || "—"}</span> },
    {
      id: "name",
      header: t("identity.lists.name"),
      className: "w-[40%]",
      cell: (row) => <span className="font-semibold">{row.name || "—"}</span>,
    },
    { id: "email", header: t("identity.lists.email"), cell: (row) => <span className="wrap-anywhere">{row.email || "—"}</span> },
  ];

  return (
    <Card
      padding="none"
      title={title}
      actions={query.data !== undefined && !query.isError ? <Badge>{t("common.count", { count: total })}</Badge> : null}
      className="min-w-0"
    >
      <QueryBoundary
        query={query}
        skeleton="table"
        isEmpty={() => rows.length === 0}
        empty={<EmptyState title={t("identity.lists.empty")} />}
        error={(error, retry) => (
          <ErrorState
            error={error}
            title={t("identity.lists.loadError")}
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
            getRowKey={(row) => row.key}
            label={title}
            renderCard={(row) => (
              <div className="flex min-w-0 items-center gap-3 px-5 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-semibold">{row.name || "—"}</span>
                  <span className="text-[13px] text-text-muted wrap-anywhere">{row.email || "—"}</span>
                </div>
                <span className="flex-none text-xs text-text-muted">{t("common.idValue", { id: row.id || "—" })}</span>
              </div>
            )}
          />
        )}
      </QueryBoundary>
    </Card>
  );
};

const IdentityOpsPage = ({ embedded = false }: { embedded?: boolean }) => {
  const { t } = useTranslation("ops");
  const { useGetAdmins, useGetManagers, useGetRegistrators } = useIdentityCoverage();
  const admins = useGetAdmins(undefined, { silentError: true });
  const managers = useGetManagers(undefined, { silentError: true });
  const registrators = useGetRegistrators(undefined, { silentError: true });

  return (
    <OpsToolPage tabKey="identity" embedded={embedded}>
      <OpsIntro title={t("identity.intro.title")} description={t("identity.intro.description")} />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] items-stretch gap-6 max-md:gap-4">
        <StaffCard title={t("identity.lists.admins")} query={admins} />
        <StaffCard title={t("identity.lists.managers")} query={managers} />
        <StaffCard title={t("identity.lists.registrators")} query={registrators} />
      </div>
    </OpsToolPage>
  );
};

export default memo(IdentityOpsPage);
