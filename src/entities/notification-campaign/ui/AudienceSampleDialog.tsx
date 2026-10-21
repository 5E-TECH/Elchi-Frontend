// dizayn-v2: superadmin-notifications-send-audience-sample-dialog
import { Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import {
  Button,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  SkeletonList,
  type DataTableColumn,
} from "../../../shared/ui/primitives";
import { useAudienceSample } from "../api/hooks";
import type { AudienceSampleItem } from "../api/campaignApi";
import type { AudienceTarget } from "../model/audience";

export type AudienceSampleDialogProps = {
  open: boolean;
  target: AudienceTarget | null;
  onClose: () => void;
};

type Row = AudienceSampleItem & { no: number };

/**
 * «AUDITORIYA NAMUNASI» (maket `superadmin-notifications-send-audience-sample-dialog`): `POST audience/preview`
 * `with_sample` — 20 tagacha qator: №, ID, Turi, Telefon (faqat `***7434` — backend maskalaydi, ism yo'q). Telefonda
 * (< 768) jadval kartalarga aylanadi, oyna pastki varaqa.
 */
export const AudienceSampleDialog = ({ open, target, onClose }: AudienceSampleDialogProps) => {
  const { t, i18n } = useTranslation("notifications");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const num = (value: number) => formatNumberLocalized(value, { language });
  const query = useAudienceSample(target, open);
  const rows: Row[] = (query.data?.sample ?? []).map((item, index) => ({ ...item, no: index + 1 }));
  const kind = (role: string | null) =>
    t(`campaign.role.${role ?? "unknown"}`, { defaultValue: t("campaign.role.unknown") });

  const columns: DataTableColumn<Row>[] = [
    { id: "no", header: t("campaign.sampleDialog.no"), align: "end", cell: (row) => num(row.no) },
    { id: "id", header: t("campaign.sampleDialog.id"), cell: (row) => `#${row.id}` },
    { id: "kind", header: t("campaign.sampleDialog.kind"), cell: (row) => kind(row.role) },
    {
      id: "phone",
      header: t("campaign.sampleDialog.phone"),
      align: "end",
      cell: (row) => <span className="tabular-nums">{row.phone ?? "—"}</span>,
    },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("campaign.sampleDialog.title")}
      description={
        query.data
          ? t("campaign.sampleDialog.description", {
              total: num(query.data.total),
              shown: num(rows.length),
            })
          : undefined
      }
      icon={Eye}
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t("campaign.sampleDialog.close")}
        </Button>
      }
    >
      <div className="flex min-w-0 flex-col gap-3" data-testid="audience-sample">
        <p className="m-0 text-[13px] text-text-muted">{t("campaign.sampleDialog.privacy")}</p>
        {query.isPending && open ? (
          <SkeletonList rows={5} />
        ) : query.isError ? (
          <ErrorState
            size="inline"
            title={t("campaign.sampleDialog.error")}
            onRetry={() => void query.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            size="inline"
            title={t("campaign.sampleDialog.empty")}
            description={t("campaign.sampleDialog.emptyHint")}
          />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            getRowKey={(row) => `${row.no}-${row.id}`}
            label={t("campaign.sampleDialog.table")}
            density="compact"
            cardsLabel={t("campaign.sampleDialog.table")}
            renderCard={(row) => (
              <div className="flex min-w-0 items-center justify-between gap-3 py-1 text-sm">
                <span className="min-w-0 text-text">
                  <span className="text-text-muted tabular-nums">{num(row.no)}. </span>
                  <span className="font-semibold">#{row.id}</span>
                  <span className="text-text-muted"> · {kind(row.role)}</span>
                </span>
                <span className="shrink-0 text-text tabular-nums">{row.phone ?? "—"}</span>
              </div>
            )}
          />
        )}
      </div>
    </Dialog>
  );
};
