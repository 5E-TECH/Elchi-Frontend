import { useState } from "react";
import { Alert, Button, Input, Select, Table, Tag } from "antd";
import { useTranslation } from "react-i18next";
import {
  useApproveSmsTemplate,
  useDeleteSmsTemplate,
  useSmsTariffs,
  useSmsTemplates,
  useUpsertSmsTemplate,
  type SmsLanguage,
  type SmsMessageClass,
  type SmsTemplate,
} from "../../../entities/sms";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { OPT_OUT_SAMPLE, templateVars } from "../../../shared/lib/smsSegments";
import SmsMeter from "../../../shared/ui/SmsMeter";

const EMPTY = { code: "", message_class: "transactional" as SmsMessageClass, lang: "uz" as SmsLanguage, text: "" };

/**
 * Shablon muharriri (nkhURiKX #6, D5sxjGBY): matn yozilayotganda kodlash,
 * bo'laklar va taxminiy narx jonli; reklamada bekor qilish ko'rsatmasi ham
 * hisobga kiradi. Matn o'zgarsa provayder tasdig'i qayta kerak.
 */
const SmsTemplatesTab = () => {
  const { t } = useTranslation("sms");
  const templates = useSmsTemplates();
  const tariffs = useSmsTariffs();
  const upsert = useUpsertSmsTemplate();
  const approve = useApproveSmsTemplate();
  const remove = useDeleteSmsTemplate();
  const [draft, setDraft] = useState(EMPTY);
  const [approvals, setApprovals] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const tariff = tariffs.data ? tariffs.data[draft.message_class] : null;
  const meterText = draft.message_class === "promo" && draft.text ? `${draft.text}${OPT_OUT_SAMPLE}` : draft.text;
  const variables = templateVars(draft.text);

  const save = async () => {
    setMessage(null);
    try {
      await upsert.mutateAsync(draft);
      setMessage({ type: "success", text: t("templates.saved") });
      setDraft(EMPTY);
    } catch (error) {
      setMessage({ type: "error", text: getBackendErrorMessage(error) ?? String(error) });
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,420px)_1fr]">
      <div className="flex min-w-0 flex-col gap-2">
        <h3 className="m-0 text-base font-bold text-maindark dark:text-white">{t("templates.new")}</h3>
        <Input
          aria-label={t("templates.code")}
          placeholder="order.delivered"
          value={draft.code}
          onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value.trim().toLowerCase() }))}
        />
        <div className="grid grid-cols-2 gap-2">
          <Select
            aria-label={t("campaign.messageClass")}
            value={draft.message_class}
            onChange={(value: SmsMessageClass) => setDraft((current) => ({ ...current, message_class: value }))}
            options={(["transactional", "promo", "security"] as const).map((value) => ({ value, label: t(`class.${value}`) }))}
          />
          <Select
            aria-label={t("templates.lang")}
            value={draft.lang}
            onChange={(value: SmsLanguage) => setDraft((current) => ({ ...current, lang: value }))}
            options={(["uz", "ru", "en"] as const).map((value) => ({ value, label: value }))}
          />
        </div>
        <Input.TextArea
          aria-label={t("templates.text")}
          rows={5}
          maxLength={1000}
          value={draft.text}
          onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))}
        />
        <p className="m-0 text-xs text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
          {t("templates.textHint")}
        </p>
        {variables.length ? (
          <div className="flex flex-wrap gap-1">
            {variables.map((name) => (
              <Tag key={name} color="purple">{`{{${name}}}`}</Tag>
            ))}
          </div>
        ) : null}
        <SmsMeter text={meterText} tariff={tariff} />
        <Button
          type="primary"
          className="self-start"
          loading={upsert.isPending}
          disabled={!draft.code || !draft.text.trim()}
          onClick={() => void save()}
        >
          {t("templates.save")}
        </Button>
        {message ? <Alert type={message.type} showIcon message={message.text} /> : null}
      </div>

      <Table<SmsTemplate>
        rowKey="id"
        size="small"
        loading={templates.isLoading}
        dataSource={templates.data ?? []}
        pagination={false}
        scroll={{ x: "max-content" }}
        locale={{ emptyText: t("templates.empty") }}
        columns={[
          { title: t("templates.code"), dataIndex: "code" },
          { title: t("templates.lang"), dataIndex: "lang" },
          { title: t("campaign.col.class"), dataIndex: "message_class", render: (value: string) => <Tag>{t(`class.${value}`)}</Tag> },
          {
            title: t("templates.text"),
            dataIndex: "text",
            render: (value: string, row) => (
              <div className="flex max-w-[320px] flex-col gap-1">
                <span className="line-clamp-2">{value}</span>
                <span className="text-xs text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
                  {row.encoding} · {t("meter.parts", { count: row.parts })}
                </span>
              </div>
            ),
          },
          {
            title: t("templates.approval"),
            dataIndex: "provider_template_id",
            render: (_: unknown, row) =>
              row.needs_provider_approval ? (
                <div className="flex min-w-[220px] gap-1">
                  <Input
                    size="small"
                    aria-label={t("templates.approve")}
                    placeholder={t("templates.approvePlaceholder")}
                    value={approvals[row.id] ?? ""}
                    onChange={(event) => setApprovals((current) => ({ ...current, [row.id]: event.target.value }))}
                  />
                  <Button
                    size="small"
                    disabled={!approvals[row.id]?.trim()}
                    onClick={() => void approve.mutateAsync({ id: row.id, providerTemplateId: approvals[row.id] })}
                  >
                    OK
                  </Button>
                </div>
              ) : (
                <Tag color="green">{t("templates.approved", { id: row.provider_template_id })}</Tag>
              ),
          },
          {
            title: "",
            key: "actions",
            render: (_: unknown, row) => (
              <div className="flex gap-1">
                <Button
                  size="small"
                  onClick={() =>
                    setDraft({ code: row.code, message_class: row.message_class, lang: row.lang, text: row.text })
                  }
                >
                  {t("templates.edit")}
                </Button>
                <Button size="small" danger onClick={() => void remove.mutateAsync(row.id)}>
                  {t("templates.delete")}
                </Button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

export default SmsTemplatesTab;
