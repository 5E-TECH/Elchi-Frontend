import { useState } from "react";
import { Alert, Input, Table, Tag } from "antd";
import { useTranslation } from "react-i18next";
import { useSmsReport, type SmsReportDay } from "../../../entities/sms";

const DAY_MS = 24 * 60 * 60 * 1000;
const ymd = (date: Date) => new Date(date.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
const sum = (value: number) => Math.round(value).toLocaleString("uz-UZ");

/** Xarajat hisoboti (8auPBa1O #6): Toshkent kuni × sinf, jami so'm, yetkazilish foizi. */
const SmsReportTab = () => {
  const { t } = useTranslation("sms");
  const [from, setFrom] = useState(() => ymd(new Date(Date.now() - 29 * DAY_MS)));
  const [to, setTo] = useState(() => ymd(new Date()));
  const report = useSmsReport(`${from}T00:00:00+05:00`, `${ymd(new Date(new Date(`${to}T00:00:00+05:00`).getTime() + DAY_MS))}T00:00:00+05:00`);
  const totals = report.data?.totals;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Input type="date" aria-label={t("report.from")} value={from} onChange={(e) => setFrom(e.target.value)} className="max-w-[180px]" />
        <Input type="date" aria-label={t("report.to")} value={to} onChange={(e) => setTo(e.target.value)} className="max-w-[180px]" />
      </div>
      {totals ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            [t("report.total"), sum(totals.total)],
            [t("report.cost"), `${sum(totals.cost)} so'm`],
            [t("report.successRate"), totals.success_rate === null ? "—" : `${totals.success_rate}%`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-[color:var(--color-border-soft)] p-4">
              <p className="m-0 text-xs text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">{label}</p>
              <p className="m-0 mt-1 text-xl font-bold text-maindark dark:text-white">{value}</p>
            </div>
          ))}
        </div>
      ) : null}
      {totals?.untariffed ? <Alert type="warning" showIcon message={t("report.untariffed", { count: totals.untariffed })} /> : null}
      <Table<SmsReportDay>
        rowKey={(row) => `${row.day}-${row.message_class}`}
        size="small"
        loading={report.isLoading}
        dataSource={report.data?.days ?? []}
        pagination={false}
        scroll={{ x: "max-content" }}
        locale={{ emptyText: t("report.empty") }}
        columns={[
          { title: t("report.col.day"), dataIndex: "day" },
          { title: t("report.col.class"), dataIndex: "message_class", render: (v: string) => <Tag>{t(`class.${v}`)}</Tag> },
          { title: t("report.col.total"), dataIndex: "total" },
          { title: t("report.col.delivered"), dataIndex: "delivered" },
          { title: t("report.col.failed"), dataIndex: "failed" },
          { title: t("report.col.parts"), dataIndex: "parts" },
          { title: t("report.col.cost"), dataIndex: "cost", render: (v: number) => sum(v) },
        ]}
      />
    </div>
  );
};

export default SmsReportTab;
