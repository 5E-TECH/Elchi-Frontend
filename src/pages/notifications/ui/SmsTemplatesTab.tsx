// dizayn-v2: superadmin-notifications-sms-templates
import { useCallback, useMemo, useRef, useState } from "react";
import { FileText, Pencil, Trash2 } from "lucide-react";
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
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import { OPT_OUT_SAMPLE, templateVars } from "../../../shared/lib/smsSegments";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  QueryBoundary,
  Select,
  SkeletonTable,
  TextInput,
  useConfirm,
  type DataTableColumn,
} from "../../../shared/ui/primitives";
import SmsMeter from "../../../shared/ui/SmsMeter";
import { useIsBelowLg } from "../lib/useIsPhoneViewport";
import { CardList } from "./sms/CardList";

const EMPTY = {
  code: "",
  message_class: "transactional" as SmsMessageClass,
  lang: "uz" as SmsLanguage,
  text: "",
};
const CLASSES = ["transactional", "promo", "security"] as const;
const LANGS = ["uz", "ru", "en"] as const;

/**
 * SHABLONLAR (nkhURiKX #6, D5sxjGBY), dizayn v2 — maket `superadmin-notifications-sms-templates`.
 *
 * «Yangi shablon»: Kod*, Xabar turi, Til, Matn* (+ o'zgaruvchilar, hisoblagich — reklamada bekor qilish ko'rsatmasi
 * ham hisobga kiradi), «Saqlash» (`POST …/templates`, kod + til bo'yicha yaratadi yoki yangilaydi; matn o'zgarsa
 * provayder tasdig'i qayta kerak). «Shablonlar» jadvali: Kod · Til · Turi · Matn (kodlash · bo'laklar) · Tasdiq
 * (tasdiq id kiritish — `PATCH …/approve`) · tahrirlash / o'chirish (tasdiq oynasi orqali). Telefonda kartalar.
 */
const SmsTemplatesTab = () => {
  const { t, i18n } = useTranslation("sms");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const templates = useSmsTemplates();
  const tariffs = useSmsTariffs();
  const upsert = useUpsertSmsTemplate();
  const approve = useApproveSmsTemplate();
  const remove = useDeleteSmsTemplate();
  const confirm = useConfirm();
  const isBelowLg = useIsBelowLg();
  const formRef = useRef<HTMLElement>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [approvals, setApprovals] = useState<Record<string, string>>({});

  const tariff = tariffs.data ? (tariffs.data[draft.message_class] ?? null) : null;
  // Javob massiv bo'lmasa (kutilmagan konvert) — sahifa yiqilmasin.
  const templatesQuery = {
    ...templates,
    data:
      templates.data === undefined
        ? undefined
        : Array.isArray(templates.data)
          ? templates.data
          : [],
  };
  const meterText =
    draft.message_class === "promo" && draft.text ? `${draft.text}${OPT_OUT_SAMPLE}` : draft.text;
  const variables = templateVars(draft.text);
  const langLabel = useCallback(
    (lang: string) => t(`templates.langs.${lang}`, { defaultValue: lang }),
    [t],
  );

  const save = async () => {
    try {
      await upsert.mutateAsync(draft);
      notify.success(t("templates.saved"));
      setDraft(EMPTY);
    } catch (error) {
      notify.error(getBackendErrorMessage(error) ?? String(error));
    }
  };

  const saveApproval = useCallback(
    async (row: SmsTemplate) => {
      try {
        await approve.mutateAsync({ id: row.id, providerTemplateId: approvals[row.id].trim() });
        notify.success(t("templates.approveSaved"));
        setApprovals((current) => ({ ...current, [row.id]: "" }));
      } catch (error) {
        notify.error(t("templates.approveFailed"), {
          description: getBackendErrorMessage(error) ?? undefined,
        });
      }
    },
    [approvals, approve, t],
  );

  const edit = useCallback((row: SmsTemplate) => {
    setDraft({ code: row.code, message_class: row.message_class, lang: row.lang, text: row.text });
    formRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, []);

  // Shablonni o'chirish buzuvchi amal — tasdiqlash oynasi orqali (DESIGN_SYSTEM §8); xato oynaning o'zida.
  const removeTemplate = useCallback(
    async (row: SmsTemplate) => {
      const ok = await confirm({
        tone: "danger",
        title: t("templates.deleteTitle"),
        description: t("templates.deleteText"),
        details: `${row.code} · ${row.lang}`,
        confirmLabel: t("templates.delete"),
        loadingLabel: t("templates.deleting"),
        icon: Trash2,
        confirmIcon: Trash2,
        irreversible: true,
        onConfirm: () => remove.mutateAsync(row.id),
      });
      if (ok) notify.success(t("templates.deleted"));
    },
    [confirm, remove, t],
  );

  const encodingSub = useCallback(
    (row: SmsTemplate) => (
      <span className="text-xs text-text-muted">
        <span className={cx(row.encoding === "UCS-2" && "text-warning-fg")}>{row.encoding}</span>
        {" · "}
        {t("meter.parts", { count: row.parts })}
      </span>
    ),
    [t],
  );

  const approval = useCallback(
    (row: SmsTemplate, layout: "table" | "card") =>
      row.needs_provider_approval ? (
        <div className={cx("flex min-w-0 flex-col gap-2", layout === "table" && "min-w-[300px]")}>
          <Badge tone="warning" dot className="self-start">
            {t("templates.needsApproval")}
          </Badge>
          <div className="flex min-w-0 gap-2">
            <TextInput
              aria-label={t("templates.approve", { code: row.code })}
              placeholder={t("templates.approvePlaceholder")}
              value={approvals[row.id] ?? ""}
              onValueChange={(value) =>
                setApprovals((current) => ({ ...current, [row.id]: value }))
              }
              className="min-w-0 flex-1"
            />
            <Button
              variant="secondary"
              size={layout === "table" ? "sm" : "md"}
              className={layout === "table" ? "self-center" : undefined}
              disabled={!approvals[row.id]?.trim()}
              loading={approve.isPending && approve.variables?.id === row.id}
              onClick={() => void saveApproval(row)}
            >
              {t("templates.approveButton")}
            </Button>
          </div>
        </div>
      ) : (
        <Badge tone="success" dot>
          {t("templates.approved", { id: row.provider_template_id })}
        </Badge>
      ),
    [approvals, approve.isPending, approve.variables, saveApproval, t],
  );

  const actions = useCallback(
    (row: SmsTemplate, size: "sm" | "md") => {
      const names = { code: row.code, lang: langLabel(row.lang) };
      return (
        <div className="flex shrink-0 justify-end gap-1">
          <IconButton
            size={size}
            icon={Pencil}
            label={t("templates.editLabel", names)}
            onClick={() => edit(row)}
          />
          <IconButton
            size={size}
            variant="danger"
            icon={Trash2}
            label={t("templates.deleteLabel", names)}
            loading={remove.isPending && remove.variables === row.id}
            onClick={() => void removeTemplate(row)}
          />
        </div>
      );
    },
    [edit, langLabel, remove.isPending, remove.variables, removeTemplate, t],
  );

  const columns = useMemo<DataTableColumn<SmsTemplate>[]>(
    () => [
      {
        id: "code",
        header: t("templates.code"),
        cell: (row) => (
          <span className="font-semibold whitespace-nowrap text-text">{row.code}</span>
        ),
      },
      {
        id: "lang",
        header: t("templates.lang"),
        cellClassName: "whitespace-nowrap",
        cell: (row) => langLabel(row.lang),
      },
      {
        id: "class",
        header: t("campaign.col.class"),
        cell: (row) => <Badge>{t(`class.${row.message_class}`)}</Badge>,
      },
      {
        id: "text",
        header: t("templates.text"),
        cell: (row) => (
          <div className="flex max-w-[340px] min-w-[240px] flex-col gap-1">
            <span>{row.text}</span>
            {encodingSub(row)}
          </div>
        ),
      },
      { id: "approval", header: t("templates.approval"), cell: (row) => approval(row, "table") },
      {
        id: "actions",
        header: <span className="sr-only">{t("templates.actions")}</span>,
        className: "w-[88px]",
        cell: (row) => actions(row, "sm"),
      },
    ],
    [actions, approval, encodingSub, langLabel, t],
  );

  const renderCard = useCallback(
    (row: SmsTemplate) => (
      <div className="flex min-w-0 flex-col gap-2 px-4 py-3">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-semibold text-text [overflow-wrap:anywhere]">{row.code}</span>
            <span className="text-xs text-text-muted">
              {langLabel(row.lang)} · {t(`class.${row.message_class}`)}
            </span>
          </span>
          {actions(row, "md")}
        </div>
        <span className="text-[13px] text-text [overflow-wrap:anywhere]">{row.text}</span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {encodingSub(row)}
          {row.needs_provider_approval ? null : approval(row, "card")}
        </div>
        {row.needs_provider_approval ? approval(row, "card") : null}
      </div>
    ),
    [actions, approval, encodingSub, langLabel, t],
  );

  return (
    <>
      <Card
        ref={formRef}
        title={t("templates.new")}
        bodyClassName="flex flex-wrap gap-x-8 gap-y-6"
        footer={
          <Button
            className="ml-auto max-md:w-full"
            loading={upsert.isPending}
            loadingText={t("templates.saving")}
            disabled={!draft.code || !draft.text.trim()}
            onClick={() => void save()}
          >
            {t("templates.save")}
          </Button>
        }
      >
        <div className="grid min-w-0 flex-[2_1_280px] grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] content-start gap-4">
          <Field label={t("templates.code")} required>
            <TextInput
              placeholder="order.delivered"
              value={draft.code}
              autoComplete="off"
              onValueChange={(value) =>
                setDraft((current) => ({ ...current, code: value.trim().toLowerCase() }))
              }
            />
          </Field>
          <Field label={t("campaign.messageClass")} labelAs="span">
            <Select
              options={CLASSES.map((value) => ({ value, label: t(`class.${value}`) }))}
              value={draft.message_class}
              onChange={(value) => {
                if (value) setDraft((current) => ({ ...current, message_class: value }));
              }}
            />
          </Field>
          <Field label={t("templates.lang")} labelAs="span">
            <Select
              options={LANGS.map((value) => ({ value, label: langLabel(value) }))}
              value={draft.lang}
              onChange={(value) => {
                if (value) setDraft((current) => ({ ...current, lang: value }));
              }}
            />
          </Field>
        </div>
        <div className="flex min-w-0 flex-[3_1_400px] flex-col gap-3">
          <Field
            label={t("templates.text")}
            required
            hint={t("templates.textHint", { example: "{{order_number}}" })}
          >
            <TextInput
              multiline
              rows={4}
              maxLength={1000}
              value={draft.text}
              onValueChange={(value) => setDraft((current) => ({ ...current, text: value }))}
            />
          </Field>
          {variables.length ? (
            <div className="flex flex-wrap gap-1.5">
              {variables.map((name) => (
                <Badge key={name}>{`{{${name}}}`}</Badge>
              ))}
            </div>
          ) : null}
          <SmsMeter text={meterText} tariff={tariff} />
        </div>
      </Card>

      <Card
        title={t("templates.list")}
        padding="none"
        actions={
          templatesQuery.data ? (
            <Badge>
              {t("count", {
                value: formatNumberLocalized(templatesQuery.data.length, { language }),
              })}
            </Badge>
          ) : null
        }
      >
        <QueryBoundary
          query={templatesQuery}
          loadingLabel={t("templates.loading")}
          loading={
            <SkeletonTable
              framed={false}
              columns={[
                t("templates.code"),
                t("templates.lang"),
                t("templates.text"),
                t("templates.approval"),
              ]}
              rows={4}
            />
          }
          empty={
            <EmptyState
              icon={FileText}
              title={t("templates.empty")}
              description={t("templates.emptyHint")}
            />
          }
          error={(error, retry) => (
            <ErrorState error={error} title={t("templates.loadError")} onRetry={retry} />
          )}
        >
          {(rows, { isRefetching }) =>
            isBelowLg ? (
              <CardList
                rows={rows}
                getRowKey={(row) => row.id}
                label={t("templates.listLabel")}
                renderCard={renderCard}
                busy={isRefetching}
              />
            ) : (
              <DataTable
                rows={rows}
                columns={columns}
                getRowKey={(row) => row.id}
                label={t("templates.listLabel")}
                renderCard={renderCard}
                busy={isRefetching}
              />
            )
          }
        </QueryBoundary>
      </Card>
    </>
  );
};

export default SmsTemplatesTab;
