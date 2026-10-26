// dizayn-v2: superadmin-payments-main-cashbox-shift-dialog-accounts
import { useEffect, useId, useRef, type ReactNode } from "react";
import {
  Ban,
  CircleCheck,
  CircleX,
  CreditCard,
  ExternalLink,
  FileImage,
  ImagePlus,
  RefreshCw,
  ScanLine,
  Settings,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { canManageShiftSettings } from "../../../../app/lib/access";
import { cx } from "../../../../shared/lib/cx";
import { formatTimeLocalized } from "../../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized, formatSignedMoneyLocalized } from "../../../../shared/lib/formatMoney";
import {
  Badge,
  Button,
  buttonClasses,
  Field,
  IconButton,
  Spinner,
  TextInput,
  TONE_FG,
  TONE_SOFT,
} from "../../../../shared/ui/primitives";
import { AiStatusBadge, EnteredMismatchBadge } from "./aiStatus";
import { cardSubtitle } from "./aiStatusMeta";
import type { ShiftAccountRow, ShiftAccountsForm } from "./useShiftAccountsForm";

/**
 * «KARTALAR VA HISOB RAQAMLAR» — smena yopish oynasining bo'limi (maket
 * `superadmin-payments-main-cashbox-shift-dialog-accounts`, kiZgTybn). Har karta qatori: nomi + bank · ··1234,
 * «Ilovadagi qoldiq *» (ostida «Tizim bo'yicha»), «Skrinshot *|(ixtiyoriy)» va AI natija chizig'i; farq ≠ 0, AI
 * «Mos kelmadi» yoki kiritilgan ≠ rasmdagi bo'lsa — «Izoh *» (backend 400 qoidalarining aynan nusxasi). Izoh maydoni
 * har doim ko'rinadi (majburiy bo'lmasa — «(ixtiyoriy)»): yopish paytida kutilgan qoldiq o'zgarib backend izoh so'rasa,
 * kassir uni yoza oladi. Backend 400 da ko'rsatgan karta qizil halqa bilan ajratiladi va ko'rinishga suriladi.
 */

const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";

const sizeText = (bytes: number, language: string) => {
  const kb = bytes / 1024;
  return kb >= 1024
    ? `${formatNumberLocalized(Math.round((kb / 1024) * 10) / 10, { language })} MB`
    : `${formatNumberLocalized(Math.max(1, Math.round(kb)), { language })} KB`;
};

type StatusLine = { tone: "neutral" | "success" | "danger" | "warning"; icon: LucideIcon | null; text: ReactNode };

const AiLine = ({ row }: { row: ShiftAccountRow }) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const money = (value: number | null) => (value === null ? "—" : formatMoneyLocalized(value, { language }));

  let line: StatusLine;
  let badge: ReactNode = <AiStatusBadge status={row.aiStatus} />;
  let trailing: ReactNode = null;
  if (!row.aiEnabled) {
    line = { tone: "neutral", icon: Ban, text: t("shiftCheck.ai.line.disabled") };
    badge = <AiStatusBadge status="disabled" />;
  } else if (!row.hasPhoto) {
    line = { tone: "neutral", icon: ScanLine, text: t("shiftCheck.ai.line.waitingPhoto") };
    badge = null;
  } else if (row.aiStatus === "pending" || row.aiStatus === "not_required") {
    line = { tone: "neutral", icon: null, text: t("shiftCheck.ai.line.pending") };
    badge = <AiStatusBadge status="pending" />;
  } else if (row.aiStatus === "match") {
    line = { tone: "neutral", icon: CircleCheck, text: t("shiftCheck.ai.line.match", { amount: money(row.aiReadBalance) }) };
  } else if (row.aiStatus === "mismatch") {
    line = {
      tone: "danger",
      icon: CircleX,
      text:
        row.aiReadBalance !== null
          ? t("shiftCheck.ai.line.mismatch", { read: money(row.aiReadBalance), expected: money(row.expected) })
          : t("shiftCheck.ai.line.mismatchNoRead"),
    };
    if (row.aiReadBalance !== null && row.expected !== null) {
      trailing = (
        <span className={cx("whitespace-nowrap font-semibold", TONE_FG.danger)}>
          {formatSignedMoneyLocalized(row.aiReadBalance - row.expected, { language })}
        </span>
      );
    }
  } else if (row.aiStatus === "unreadable") {
    line = { tone: "warning", icon: TriangleAlert, text: t("shiftCheck.ai.line.unreadable") };
  } else if (row.aiStatus === "error") {
    line = { tone: "neutral", icon: TriangleAlert, text: t("shiftCheck.ai.line.error") };
  } else {
    line = { tone: "neutral", icon: Ban, text: t("shiftCheck.ai.line.disabled") };
  }
  const Icon = line.icon;

  return (
    <div className="flex flex-col gap-2">
      <div
        role="status"
        className={cx(
          "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[10px] px-3 py-2 text-[13px]",
          line.tone === "neutral" ? "bg-sunken text-text-muted" : TONE_SOFT[line.tone],
        )}
      >
        <span className="inline-flex min-w-0 flex-[1_1_220px] items-center gap-2">
          {Icon ? <Icon aria-hidden="true" size={16} className="shrink-0" /> : <Spinner size="sm" />}
          <span className="min-w-0">{line.text}</span>
        </span>
        <span className="inline-flex flex-wrap items-center gap-2">
          {trailing}
          {badge}
        </span>
      </div>
      {row.hasPhoto && row.enteredOk === false ? (
        <div
          role="status"
          className={cx(
            "flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-[10px] px-3 py-2 text-[13px]",
            TONE_SOFT.danger,
          )}
        >
          <span className="min-w-0">{t("shiftCheck.ai.line.enteredMismatch", { read: money(row.aiReadBalance) })}</span>
          <EnteredMismatchBadge />
        </div>
      ) : null}
    </div>
  );
};

const PhotoControl = ({
  row,
  canUpload,
  onFile,
  describedBy,
}: {
  row: ShiftAccountRow;
  canUpload: boolean;
  onFile: (file: File) => void;
  describedBy?: string;
}) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const inputRef = useRef<HTMLInputElement>(null);
  const pick = () => inputRef.current?.click();
  const name = row.localPhoto?.name ?? t("shiftCheck.accounts.uploaded");
  const uploadedAt = row.localPhoto?.at ?? (row.draft?.photo_uploaded_at ? new Date(row.draft.photo_uploaded_at) : null);
  const meta = [
    uploadedAt && !Number.isNaN(uploadedAt.getTime()) ? formatTimeLocalized(uploadedAt) : null,
    row.localPhoto ? sizeText(row.localPhoto.size, language) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={PHOTO_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid={`shift-photo-input-${row.card.card_id}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
      {row.hasPhoto && !row.uploading ? (
        <div className="flex min-h-11 min-w-0 items-center gap-3 rounded-[10px] border border-border bg-surface px-3 py-1.5">
          <FileImage aria-hidden="true" size={20} className="shrink-0 text-text-muted" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold text-text">{name}</span>
            {meta ? <span className="text-xs text-text-muted">{meta}</span> : null}
          </span>
          {row.photoUrl ? (
            <a
              href={row.photoUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonClasses({ variant: "ghost", size: "sm" })}
              aria-label={t("shiftCheck.accounts.open")}
              title={t("shiftCheck.accounts.open")}
            >
              <ExternalLink aria-hidden="true" size={16} />
            </a>
          ) : null}
          <IconButton
            icon={RefreshCw}
            size="sm"
            variant="ghost"
            label={t("shiftCheck.accounts.replace")}
            onClick={pick}
            disabled={!canUpload}
          />
        </div>
      ) : (
        <Button
          variant="secondary"
          leftIcon={ImagePlus}
          className="w-full"
          onClick={pick}
          loading={row.uploading}
          loadingText={t("shiftCheck.accounts.uploading")}
          disabled={!canUpload}
          aria-describedby={describedBy}
        >
          {t("shiftCheck.accounts.upload")}
        </Button>
      )}
    </>
  );
};

const AccountRow = ({
  row,
  submitted,
  canUpload,
  form,
}: {
  row: ShiftAccountRow;
  submitted: boolean;
  canUpload: boolean;
  form: ShiftAccountsForm;
}) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const photoErrorId = useId();
  const cardId = row.card.card_id;
  const subtitle = cardSubtitle(row.card);
  const itemRef = useRef<HTMLLIElement>(null);
  const highlighted = row.serverIssue !== null;
  useEffect(() => {
    if (highlighted) itemRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [highlighted]);
  const show = (error: "entered" | "photo" | "comment") =>
    (submitted || row.serverIssue === error) && row.errors.includes(error);
  const photoError =
    row.photoError === "type"
      ? t("shiftCheck.accounts.errors.photoType")
      : row.photoError === "size"
        ? t("shiftCheck.accounts.errors.photoSize")
        : row.photoError === "upload"
          ? row.uploadMessage || t("shiftCheck.accounts.errors.upload")
          : show("photo")
            ? t("shiftCheck.accounts.errors.photo")
            : undefined;

  return (
    <li
      ref={itemRef}
      className={cx(
        "flex flex-col gap-3 border-b border-border px-4 py-4 last:border-b-0 max-md:px-3",
        // Backend 400 da ko'rsatgan karta — qizil halqa (`.el-field` xato halqasi bilan bir xil ton).
        highlighted && "rounded-xl ring-2 ring-inset ring-danger-fg/50",
      )}
      data-testid={`shift-account-${cardId}`}
      data-highlighted={highlighted || undefined}
    >
      <div className="grid gap-x-4 gap-y-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-sunken text-text-muted">
            <CreditCard aria-hidden="true" size={18} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-text">{row.card.name}</span>
            {subtitle ? <span className="truncate text-[13px] text-text-muted">{subtitle}</span> : null}
          </span>
        </div>
        <Field
          label={t("shiftCheck.accounts.entered")}
          required
          hint={
            <>
              {t("shiftCheck.accounts.system")}{" "}
              <span className="whitespace-nowrap font-semibold text-text">
                {row.expected === null ? "—" : formatMoneyLocalized(row.expected, { language })}
              </span>
            </>
          }
          error={show("entered") ? t("shiftCheck.accounts.errors.entered") : undefined}
        >
          <TextInput
            mode="money"
            value={row.enteredInput}
            onValueChange={(value) => form.setRowInput(cardId, { entered: value })}
            placeholder="0"
            autoComplete="off"
          />
        </Field>
        <Field
          label={t("shiftCheck.accounts.photo")}
          labelAs="span"
          required={row.photoRequired}
          labelAside={
            row.photoRequired ? undefined : (
              <span className="text-[13px] text-text-muted">{t("shiftCheck.accounts.photoOptional")}</span>
            )
          }
          error={photoError}
          id={photoErrorId}
        >
          <PhotoControl
            row={row}
            canUpload={canUpload}
            onFile={(file) => void form.uploadPhoto(cardId, file)}
          />
        </Field>
      </div>

      <AiLine row={row} />

      <Field
        label={t("shiftCheck.accounts.comment")}
        required={row.commentRequired}
        optional={!row.commentRequired}
        hint={row.commentRequired ? t("shiftCheck.accounts.commentHint") : undefined}
        error={show("comment") ? t("shiftCheck.accounts.errors.comment") : undefined}
      >
        <TextInput
          multiline
          rows={2}
          value={row.comment}
          onValueChange={(value) => form.setRowInput(cardId, { comment: value })}
          placeholder={
            row.commentRequired ? t("shiftCheck.accounts.commentPlaceholder") : t("shiftCheck.accounts.commentOptionalPlaceholder")
          }
        />
      </Field>
    </li>
  );
};

const ShiftAccountsSection = ({ form, submitted }: { form: ShiftAccountsForm; submitted: boolean }) => {
  const { t } = useTranslation("payments");
  const canOpenSettings = useSelector(canManageShiftSettings);
  const headingId = useId();
  const anyAi = form.rows.some((row) => row.aiEnabled);
  const commentRows = form.rows.filter((row) => row.commentRequired).length;
  const pendingRows = form.rows.filter((row) => row.aiEnabled && row.hasPhoto && row.aiStatus === "pending").length;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3" data-testid="shift-accounts-section">
      {commentRows > 0 || pendingRows > 0 ? (
        <div role="status" className={cx("flex min-w-0 items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT.warning)}>
          <TriangleAlert size={18} aria-hidden="true" className="mt-px shrink-0" />
          <span className="flex min-w-0 flex-col gap-0.5">
            {commentRows > 0 ? (
              <span className="font-bold text-text">{t("shiftCheck.accounts.alert", { count: commentRows })}</span>
            ) : null}
            {pendingRows > 0 ? (
              <span className="text-text">{t("shiftCheck.accounts.pending", { count: pendingRows })}</span>
            ) : null}
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="inline-flex items-center gap-2 text-sm font-bold text-text">
          <CreditCard aria-hidden="true" size={16} className="text-text-muted" />
          {t("shiftCheck.accounts.title")}
          <Badge tone="neutral">{form.rows.length}</Badge>
        </h3>
        {canOpenSettings ? (
          <Link to="/payments/shift-settings" className={buttonClasses({ variant: "ghost", size: "sm" })}>
            <Settings aria-hidden="true" size={16} />
            {t("shiftCheck.accounts.settings")}
          </Link>
        ) : null}
      </div>
      <p className="m-0 text-[13px] text-text-muted">
        {anyAi ? t("shiftCheck.accounts.hint") : t("shiftCheck.accounts.hintNoAi")}
      </p>

      {form.rows.length === 0 ? (
        <p className="m-0 rounded-[10px] bg-sunken px-3 py-2 text-[13px] text-text-muted">{t("shiftCheck.accounts.empty")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col rounded-xl border border-border p-0">
          {form.rows.map((row) => (
            <AccountRow key={row.card.card_id} row={row} submitted={submitted} canUpload={form.canUpload} form={form} />
          ))}
        </ul>
      )}
    </section>
  );
};

export default ShiftAccountsSection;
