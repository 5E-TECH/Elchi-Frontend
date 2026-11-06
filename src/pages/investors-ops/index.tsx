// dizayn-v2: superadmin-ops-investors
import { memo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useInvestors } from "../../entities/investors";
import { formatNumberLocalized } from "../../shared/lib/formatMoney";
import { formatPhone } from "../../shared/lib/formatPhone";
import { normalizePersonName } from "../../shared/lib/personName";
import { isCompleteUzbekistanPhone } from "../../shared/lib/phone";
import {
  Badge,
  buttonClasses,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  Pagination,
  QueryBoundary,
  TextInput,
  type DataTableColumn,
} from "../../shared/ui/primitives";
import { OpsAlert, OpsIntro, OpsToolPage } from "../ops/ui/OpsToolPage";
import { useOpsErrorText } from "../ops/lib/opsErrorText";

/**
 * OPS → «Investorlar» (maket `superadmin-ops-investors`): ro'yxat (`GET investors?page&limit`, 10 tadan) va
 * «Yangi investor» formasi (`POST investors` — `{ name, phone_number }`, telefon `+998XXXXXXXXX`).
 */

const PAGE_SIZE = 10;
type InvestorRow = { key: string; id: string; name: string; phone: string; share: number | null };

const toRow = (item: Record<string, unknown>, index: number): InvestorRow => {
  const id = item.id == null ? "" : String(item.id);
  return {
    key: id || `investor-${index}`,
    id,
    name: item.name == null ? "" : String(item.name),
    phone: item.phone_number == null ? "" : String(item.phone_number),
    share: item.share_percent == null || item.share_percent === "" ? null : Number(item.share_percent),
  };
};

const InvestorsOpsPage = ({ embedded = false }: { embedded?: boolean }) => {
  const { t, i18n } = useTranslation("ops");
  const { useGetInvestors, createInvestor } = useInvestors();
  // Rad etilgan so'rov — o'z matnimiz (backend xabari ko'rsatilmaydi, LJt0G1y1).
  const errorText = useOpsErrorText();

  const [page, setPage] = useState(1);
  const investorsQuery = useGetInvestors({ page, limit: PAGE_SIZE }, { silentError: true });
  const rows = (Array.isArray(investorsQuery.data?.items) ? investorsQuery.data.items : []).map((item, index) =>
    toRow(item as Record<string, unknown>, index),
  );
  const total = Number(investorsQuery.data?.meta?.total ?? rows.length) || rows.length;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [created, setCreated] = useState<{ name: string; phone: string } | null>(null);

  const nameError = touched && !name.trim() ? t("investors.create.nameRequired") : undefined;
  const phoneComplete = isCompleteUzbekistanPhone(phone);
  const phoneError = touched && !phoneComplete ? t("investors.create.phoneRequired") : undefined;

  const handleCreate = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!name.trim() || !phoneComplete || createInvestor.isPending) return;
    // Investor — shaxs: har so'z bosh harfi katta (Enter bilan yuborilsa maydon blur bo'lmagan bo'lishi mumkin).
    const payload = { name: normalizePersonName(name), phone_number: phone };
    setCreated(null);
    createInvestor.mutate(payload, {
      onSuccess: () => {
        setCreated({ name: payload.name, phone: payload.phone_number });
        setName("");
        setPhone("");
        setTouched(false);
      },
    });
  };

  const phoneText = (value: string) => (value ? formatPhone(value) : "—");
  // vpKijXce: kabinet nazorat uchun (`/investor/:id`, faqat o'qish).
  const cabinetLink = (row: InvestorRow) =>
    row.id ? (
      <Link
        to={`/investor/${row.id}`}
        aria-label={t("investors.list.openAria", { name: row.name || row.id })}
        className={buttonClasses({ variant: "secondary", size: "sm", className: "max-md:min-h-11" })}
      >
        {t("investors.list.open")}
      </Link>
    ) : null;

  const columns: DataTableColumn<InvestorRow>[] = [
    {
      id: "id",
      header: t("investors.list.id"),
      className: "w-[72px]",
      cell: (row) => <span className="text-text-muted">{row.id || "—"}</span>,
    },
    { id: "name", header: t("investors.list.name"), cell: (row) => <span className="font-semibold">{row.name || "—"}</span> },
    { id: "phone", header: t("investors.list.phone"), cell: (row) => <span className="whitespace-nowrap">{phoneText(row.phone)}</span> },
    {
      id: "share",
      header: t("investors.list.share"),
      align: "end",
      cell: (row) => (
        <span className="whitespace-nowrap tabular-nums">
          {row.share == null || !Number.isFinite(row.share) ? "—" : `${formatNumberLocalized(row.share, { language: i18n.language, fractionDigits: 2 })}%`}
        </span>
      ),
    },
    {
      id: "open",
      header: <span className="sr-only">{t("investors.list.actions")}</span>,
      align: "end",
      cell: (row) => cabinetLink(row),
    },
  ];

  return (
    <OpsToolPage tabKey="investors" embedded={embedded}>
      <OpsIntro title={t("investors.intro.title")} description={t("investors.intro.description")} />

      <div className="flex flex-wrap items-start gap-6 max-md:gap-4">
        <Card
          padding="none"
          title={t("investors.list.title")}
          actions={investorsQuery.data !== undefined && !investorsQuery.isError ? <Badge>{t("common.count", { count: total })}</Badge> : null}
          className="min-w-0 flex-[2_1_480px]"
          footer={
            total > PAGE_SIZE && !investorsQuery.isError ? (
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                onPageChange={setPage}
                summary={(range) => t("investors.list.summary", range)}
              />
            ) : undefined
          }
        >
          <QueryBoundary
            query={investorsQuery}
            skeleton="table"
            isEmpty={() => rows.length === 0}
            empty={<EmptyState title={t("investors.list.empty")} description={t("investors.list.emptyHint")} />}
            error={(error, retry) => (
              <ErrorState
                error={error}
                title={t("investors.list.loadError")}
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
                label={t("investors.list.title")}
                renderCard={(row) => (
                  <div className="flex min-w-0 items-center gap-3 px-4 py-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-semibold">{row.name || "—"}</span>
                      <span className="text-[13px] text-text-muted">{phoneText(row.phone)}</span>
                    </div>
                    <span className="shrink-0 text-xs text-text-muted">{t("common.idValue", { id: row.id || "—" })}</span>
                    {cabinetLink(row)}
                  </div>
                )}
              />
            )}
          </QueryBoundary>
        </Card>

        <Card
          title={t("investors.create.title")}
          description={t("investors.create.description")}
          className="min-w-0 flex-[1_1_320px]"
        >
          <form onSubmit={handleCreate} noValidate className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-x-3 gap-y-4">
              <Field label={t("investors.create.name")} required error={nameError} className="min-w-0 flex-[2_1_220px]">
                <TextInput
                  personName
                  autoComplete="name"
                  value={name}
                  onValueChange={setName}
                  placeholder={t("investors.create.namePlaceholder")}
                />
              </Field>
              <Field label={t("investors.create.phone")} required error={phoneError} className="min-w-0 flex-[2_1_220px]">
                <TextInput
                  mode="phone"
                  autoComplete="tel"
                  value={phone}
                  onValueChange={setPhone}
                  placeholder={t("investors.create.phonePlaceholder")}
                />
              </Field>
              <Button type="submit" leftIcon={Plus} loading={createInvestor.isPending} className="flex-[1_1_160px]">
                {t("investors.create.submit")}
              </Button>
            </div>
            {created && !createInvestor.isError ? (
              <OpsAlert tone="success" title={t("investors.create.success")}>
                {`${created.name} · ${formatPhone(created.phone)}`}
              </OpsAlert>
            ) : null}
            {createInvestor.isError ? (
              <OpsAlert tone="danger" title={t("investors.create.error")}>
                {errorText(createInvestor.error, { action: true })}
              </OpsAlert>
            ) : null}
          </form>
        </Card>
      </div>
    </OpsToolPage>
  );
};

export default memo(InvestorsOpsPage);
