import { useMemo, useState } from "react";
import { Alert, Button, Input, InputNumber, Modal, Segmented, Select, Table, Tag } from "antd";
import { useTranslation } from "react-i18next";
import {
  previewSmsCampaign,
  useSendSmsCampaign,
  useSmsCampaigns,
  useSmsTariffs,
  useSmsTemplates,
  type SmsCampaignHistoryItem,
  type SmsCampaignInput,
  type SmsCampaignPreview,
} from "../../../entities/sms";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { fillTemplate, OPT_OUT_SAMPLE, templateVars } from "../../../shared/lib/smsSegments";
import SmsMeter from "../../../shared/ui/SmsMeter";

type Audience = "phones" | "segment";

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const formatSum = (value: number) => `${Math.round(value).toLocaleString("uz-UZ")} so'm`;

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent", dateStyle: "short", timeStyle: "short" });

const Label = ({ children }: { children: React.ReactNode }) => (
  <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
    {children}
  </span>
);

/**
 * SMS kampaniyasi (sVByLMnt #6/#7): matn/shablon → kimga → ko'rib chiqish →
 * tasdiq oynasi (ANIQ qabul qiluvchilar, roziligi yo'qlar, prognoz narx,
 * to'liq matn) → yuborish → tarix. `{{var}}` to'ldirilmasa yuborish bloklanadi.
 */
const CampaignPage = () => {
  const { t } = useTranslation("sms");
  const tariffs = useSmsTariffs();
  const templates = useSmsTemplates();
  const history = useSmsCampaigns();
  const sendCampaign = useSendSmsCampaign();

  const [messageClass, setMessageClass] = useState<"promo" | "transactional">("promo");
  const [templateCode, setTemplateCode] = useState<string>("");
  const [text, setText] = useState("");
  const [vars, setVars] = useState<Record<string, string>>({});
  const [audience, setAudience] = useState<Audience>("phones");
  const [phones, setPhones] = useState("");
  const [segment, setSegment] = useState<{
    market_id?: string;
    region_id?: string;
    district_id?: string;
    last_order_from?: string;
    last_order_to?: string;
    min_orders?: number;
  }>({});

  const [preview, setPreview] = useState<SmsCampaignPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const template = templates.data?.find((item) => item.code === templateCode && item.lang === "uz") ??
    templates.data?.find((item) => item.code === templateCode);
  const sourceText = template ? template.text : text;
  const effectiveClass = template ? (template.message_class === "promo" ? "promo" : "transactional") : messageClass;
  const variables = useMemo(() => templateVars(sourceText), [sourceText]);
  const missing = variables.filter((name) => !vars[name]?.trim());
  const filled = fillTemplate(sourceText, vars);
  const finalText = effectiveClass === "promo" && filled ? `${filled}${OPT_OUT_SAMPLE}` : filled;
  const phoneList = phones
    .split(/[\n,;]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const recipientsGuess = audience === "phones" ? phoneList.length : 1;

  const input = (): SmsCampaignInput => ({
    ...(template ? { template_code: template.code, lang: template.lang } : { message_class: messageClass, text: text.trim() }),
    ...(variables.length ? { vars } : {}),
    segment:
      audience === "phones"
        ? { phones: phoneList }
        : Object.fromEntries(Object.entries(segment).filter(([, value]) => value !== undefined && value !== "")),
  });

  const canPreview =
    Boolean(sourceText.trim()) &&
    missing.length === 0 &&
    (audience === "segment" || phoneList.length > 0);

  const openPreview = async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    setResult(null);
    try {
      const data = await previewSmsCampaign(input());
      setPreview(data);
      // Bir tasdiq oynasi — bitta kalit: 504 dan keyin qayta bosilsa ham ikki marta ketmaydi.
      setIdempotencyKey(newKey());
    } catch (error) {
      setPreviewError(getBackendErrorMessage(error) ?? t("campaign.failed"));
    } finally {
      setPreviewLoading(false);
    }
  };

  const confirmSend = async () => {
    if (!idempotencyKey) return;
    try {
      const res = await sendCampaign.mutateAsync({ input: input(), idempotencyKey });
      setResult({
        type: "success",
        message: t("campaign.sent", {
          queued: res.queued,
          blocked: res.blocked_no_consent,
          skipped: res.skipped_invalid_phone,
        }),
      });
      setPreview(null);
      setIdempotencyKey(null);
    } catch (error) {
      setResult({ type: "error", message: getBackendErrorMessage(error) ?? t("campaign.failed") });
      setPreview(null);
    }
  };

  const tariff = effectiveClass === "promo" ? (tariffs.data?.promo ?? null) : (tariffs.data?.transactional ?? null);
  const scheduledLater = preview && new Date(preview.scheduled_for).getTime() - Date.now() > 60_000;
  const blockedSend = !preview || preview.recipients === 0 || preview.fanout_exceeded;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{t("campaign.template")}</Label>
            <Select
              aria-label={t("campaign.template")}
              value={templateCode}
              onChange={(value: string) => setTemplateCode(value)}
              options={[
                { value: "", label: t("campaign.templateNone") },
                ...[...new Map((templates.data ?? []).filter((item) => item.message_class !== "security").map((item) => [item.code, item])).values()].map(
                  (item) => ({ value: item.code, label: `${item.code} · ${t(`class.${item.message_class}`)}` }),
                ),
              ]}
            />
          </div>

          {!template ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>{t("campaign.messageClass")}</Label>
                <Segmented
                  block
                  value={messageClass}
                  onChange={(value) => setMessageClass(value as "promo" | "transactional")}
                  options={[
                    { value: "promo", label: t("class.promo") },
                    { value: "transactional", label: t("class.transactional") },
                  ]}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("campaign.text")}</Label>
                <Input.TextArea
                  aria-label={t("campaign.text")}
                  rows={5}
                  maxLength={1000}
                  value={text}
                  placeholder={t("campaign.textPlaceholder")}
                  onChange={(event) => setText(event.target.value)}
                />
              </div>
            </>
          ) : (
            <pre className="m-0 whitespace-pre-wrap rounded-xl border border-[color:var(--color-border-soft)] p-3 text-sm">
              {template.text}
            </pre>
          )}

          {effectiveClass === "promo" ? (
            <p className="m-0 text-xs text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
              {t("campaign.promoHint")}
            </p>
          ) : null}

          {variables.length ? (
            <div className="flex flex-col gap-1.5">
              <Label>{t("campaign.vars")}</Label>
              {variables.map((name) => (
                <Input
                  key={name}
                  aria-label={name}
                  addonBefore={`{{${name}}}`}
                  value={vars[name] ?? ""}
                  status={vars[name]?.trim() ? undefined : "error"}
                  placeholder={t("campaign.varMissing")}
                  onChange={(event) => setVars((current) => ({ ...current, [name]: event.target.value }))}
                />
              ))}
            </div>
          ) : null}

          <SmsMeter text={finalText} recipients={recipientsGuess} tariff={tariff} />
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{t("campaign.audience")}</Label>
            <Segmented
              block
              value={audience}
              onChange={(value) => setAudience(value as Audience)}
              options={[
                { value: "phones", label: t("campaign.audiencePhones") },
                { value: "segment", label: t("campaign.audienceSegment") },
              ]}
            />
          </div>
          {audience === "phones" ? (
            <Input.TextArea
              aria-label={t("campaign.phones")}
              rows={6}
              value={phones}
              placeholder={"+998901234567\n+998911234567"}
              onChange={(event) => setPhones(event.target.value)}
            />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(["market_id", "region_id", "district_id"] as const).map((key) => (
                <Input
                  key={key}
                  aria-label={t(`campaign.${key === "market_id" ? "marketId" : key === "region_id" ? "regionId" : "districtId"}`)}
                  placeholder={t(`campaign.${key === "market_id" ? "marketId" : key === "region_id" ? "regionId" : "districtId"}`)}
                  value={segment[key] ?? ""}
                  onChange={(event) => setSegment((current) => ({ ...current, [key]: event.target.value.replace(/\D/g, "") }))}
                />
              ))}
              <InputNumber
                aria-label={t("campaign.minOrders")}
                placeholder={t("campaign.minOrders")}
                min={1}
                className="w-full"
                value={segment.min_orders}
                onChange={(value) => setSegment((current) => ({ ...current, min_orders: value ?? undefined }))}
              />
              <Input
                type="date"
                aria-label={t("campaign.lastOrderFrom")}
                value={segment.last_order_from ?? ""}
                onChange={(event) => setSegment((current) => ({ ...current, last_order_from: event.target.value }))}
              />
              <Input
                type="date"
                aria-label={t("campaign.lastOrderTo")}
                value={segment.last_order_to ?? ""}
                onChange={(event) => setSegment((current) => ({ ...current, last_order_to: event.target.value }))}
              />
            </div>
          )}

          <Button
            type="primary"
            size="large"
            className="self-start"
            disabled={!canPreview}
            loading={previewLoading}
            onClick={() => void openPreview()}
          >
            {t("campaign.preview")}
          </Button>
          {previewError ? <Alert type="error" showIcon message={previewError} /> : null}
          {result ? <Alert type={result.type} showIcon message={result.message} /> : null}
        </div>
      </div>

      <Modal
        open={Boolean(preview)}
        title={t("campaign.confirmTitle")}
        onCancel={() => setPreview(null)}
        okText={t("campaign.send")}
        cancelText={t("campaign.cancel")}
        okButtonProps={{ danger: true, disabled: blockedSend, loading: sendCampaign.isPending }}
        onOk={() => void confirmSend()}
        destroyOnHidden
      >
        {preview ? (
          <div data-testid="campaign-confirm" className="flex flex-col gap-2 text-sm">
            <p className="m-0 font-bold">{t("campaign.confirmRecipients", { count: preview.recipients })}</p>
            <p className="m-0">{t("campaign.confirmBlocked", { count: preview.blocked_no_consent })}</p>
            <p className="m-0">{t("campaign.confirmInvalid", { count: preview.skipped_invalid_phone })}</p>
            <p className="m-0">
              {preview.estimated_cost === null
                ? t("campaign.confirmCostUnknown")
                : t("campaign.confirmCost", { value: formatSum(preview.estimated_cost) })}
              {" · "}
              {t("campaign.confirmParts", { encoding: preview.encoding, parts: preview.parts })}
            </p>
            {scheduledLater ? (
              <Alert type="info" showIcon message={t("campaign.confirmScheduled", { time: formatTime(preview.scheduled_for) })} />
            ) : null}
            {preview.fanout_exceeded ? (
              <Alert type="error" showIcon message={t("campaign.fanoutExceeded", { max: preview.max_fanout })} />
            ) : null}
            {!preview.sms_enabled ? <Alert type="warning" showIcon message={t("campaign.smsDisabled")} /> : null}
            <p className="m-0 font-semibold">{t("campaign.confirmIrreversible")}</p>
            <span className="text-xs text-[color:var(--color-text-muted)] dark:text-[color:var(--color-text-muted-dark)]">
              {t("campaign.confirmFullText")}
            </span>
            <pre className="m-0 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-[color:var(--color-border-soft)] p-3">
              {preview.sample_text}
            </pre>
          </div>
        ) : null}
      </Modal>

      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-base font-bold text-maindark dark:text-white">{t("campaign.history")}</h3>
        <Table<SmsCampaignHistoryItem>
          rowKey="id"
          size="small"
          loading={history.isLoading}
          dataSource={history.data ?? []}
          pagination={false}
          scroll={{ x: "max-content" }}
          locale={{ emptyText: t("campaign.historyEmpty") }}
          columns={[
            { title: t("campaign.col.date"), dataIndex: "created_at", render: (value: string) => formatTime(value) },
            {
              title: t("campaign.col.class"),
              dataIndex: "message_class",
              render: (value: string) => <Tag>{t(`class.${value}`)}</Tag>,
            },
            {
              title: t("campaign.col.text"),
              dataIndex: "text",
              render: (value: string) => <span className="line-clamp-2 max-w-[280px]">{value}</span>,
            },
            { title: t("campaign.col.queued"), dataIndex: "queued" },
            { title: t("campaign.col.delivered"), dataIndex: "delivered" },
            { title: t("campaign.col.failed"), dataIndex: "failed" },
            { title: t("campaign.col.blocked"), dataIndex: "blocked" },
            { title: t("campaign.col.pending"), dataIndex: "pending" },
          ]}
        />
      </div>
    </div>
  );
};

export default CampaignPage;
