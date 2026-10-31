// dizayn-v2: superadmin-payments-main-cashbox-expense-receipt-dialog, superadmin-payments-main-cashbox-expense-receipt-states, admin-payments-cashbox-form-dialog-receipt, manager-payments-cashbox-form-dialog-receipt, superadmin-payments-cash-detail-courier-receipt, superadmin-payments-cash-detail-branch-receipt
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, CircleX, ImagePlus, Info, RefreshCw, Settings, WifiOff, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { canManageShiftSettings } from "../../../../app/lib/access";
import { RECEIPT_PHOTO_ACCEPT, RECEIPT_PHOTO_MAX_BYTES } from "../../../../entities/payments";
import { cx } from "../../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import {
  Button,
  buttonClasses,
  Field,
  IconButton,
  Pressable,
  Skeleton,
  Spinner,
} from "../../../../shared/ui/primitives";
import ReceiptViewerDialog from "./ReceiptViewerDialog";
import type { ReceiptFieldController } from "./useReceiptField";

/**
 * «CHEK RASMI» MAYDONI (QlLf33Ma; maketlar `…-expense-receipt-dialog`, `…-expense-receipt-states`). Holatlar: bo'sh
 * (tanlash maydoni), sozlama yuklanmoqda (skelet), tayyorlanmoqda / yuklanmoqda (foiz, «To'xtatish»), yuklandi (eskiz →
 * ko'ruvchi, «Almashtirish», «Olib tashlash»), yuklab bo'lmadi («Qayta urinish»), internet yo'q. Xato matni — `Field`
 * ostida. Superadminga «Sozlamalar» havolasi (`/payments/shift-settings`). Holat — `useReceiptField`.
 */

const receiptSizeText = (bytes: number, language: string) => {
  const kb = bytes / 1024;
  return kb >= 1024
    ? `${formatNumberLocalized(Math.round((kb / 1024) * 10) / 10, { language, fractionDigits: 1 })} MB`
    : `${formatNumberLocalized(Math.max(1, Math.round(kb)), { language })} KB`;
};

const ROW = "flex min-w-0 items-center gap-3 rounded-xl border bg-input px-3 py-2.5";
const NAME = "truncate text-[13px] font-semibold text-text";

const HintLine = ({ icon: Icon, children }: { icon: typeof Info; children: ReactNode }) => (
  <span className="flex items-start gap-1.5">
    <Icon aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
    <span className="min-w-0">{children}</span>
  </span>
);

/** Tasdiq oynasidagi «Chek» qatori qiymati (maket `…-expense-receipt-confirm`). */
export const ReceiptAttachedValue = () => {
  const { t } = useTranslation("payments");
  return (
    <span className="inline-flex items-center gap-1.5 text-success-fg">
      <CircleCheck aria-hidden="true" size={16} />
      {t("receipt.confirm.attached")}
    </span>
  );
};

const ReceiptField = ({ receipt, viewerDescription }: { receipt: ReceiptFieldController; viewerDescription?: string }) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const canOpenSettings = useSelector(canManageShiftSettings);
  const fieldId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const { draft, fieldIssue, online } = receipt;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { focusRequest } = receipt;
  const pick = () => inputRef.current?.click();

  // Xato chiqdi («saqlash» bosildi yoki server rad etdi) — maydon ko'rinishga suriladi, fokus unda.
  useEffect(() => {
    if (focusRequest === 0) return;
    triggerRef.current?.focus();
    triggerRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [focusRequest]);

  if (!receipt.visible) return null;

  if (receipt.settingsLoading) {
    return (
      <div className="flex flex-col gap-1.5" aria-busy="true" data-testid="receipt-field-loading">
        <Skeleton shape="line" width={96} />
        <Skeleton shape="block" className="block h-16" />
        <span className="sr-only" role="status">
          {t("receipt.field.settingsLoading")}
        </span>
      </div>
    );
  }

  const error = fieldIssue
    ? t(`receipt.errors.${fieldIssue}`)
    : draft.fileIssue
      ? t(`receipt.errors.file.${draft.fileIssue}`)
      : draft.status === "failed" && draft.uploadMessage
        ? draft.uploadMessage
        : undefined;
  const hasError = Boolean(fieldIssue || draft.fileIssue);
  const hint = !online ? (
    <HintLine icon={WifiOff}>{t("receipt.field.offline")}</HintLine>
  ) : !receipt.aiEnabled ? (
    <HintLine icon={Info}>{t("receipt.field.aiOff")}</HintLine>
  ) : (
    t("receipt.field.hint")
  );

  const working = draft.status === "preparing" || draft.status === "uploading";
  const compressed = draft.size !== null && draft.bytes !== null && draft.size > RECEIPT_PHOTO_MAX_BYTES;

  return (
    <Field
      id={fieldId}
      role="group"
      aria-labelledby={`${fieldId}-label`}
      labelAs="span"
      label={t("receipt.field.label")}
      required={receipt.required}
      labelAside={
        canOpenSettings ? (
          <Link to="/payments/shift-settings" className={buttonClasses({ variant: "ghost", size: "sm", className: "-mr-2" })}>
            <Settings aria-hidden="true" size={16} />
            {t("receipt.field.settings")}
          </Link>
        ) : undefined
      }
      hint={hint}
      error={error}
      data-testid="receipt-field"
    >
      <input
        ref={inputRef}
        type="file"
        accept={RECEIPT_PHOTO_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        disabled={!online}
        data-testid="receipt-file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) receipt.selectFile(file);
        }}
      />

      {draft.status === "empty" ? (
        <Pressable
          ref={triggerRef}
          disabled={!online}
          aria-invalid={hasError || undefined}
          onClick={pick}
          className={cx(
            "flex min-h-16 w-full min-w-0 items-center gap-3 rounded-xl border-2 border-dashed px-3.5 py-2.5 text-left",
            "transition-[background-color,border-color] duration-150 motion-reduce:transition-none",
            hasError ? "border-danger" : "border-border-strong",
            online ? "cursor-pointer bg-input hover:bg-row-hover" : "cursor-not-allowed bg-sunken text-text-subtle",
          )}
        >
          <span
            className={cx(
              "grid size-10 shrink-0 place-items-center rounded-full",
              online ? "bg-sunken text-text-muted" : "bg-surface text-text-subtle",
            )}
          >
            <ImagePlus aria-hidden="true" size={20} />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-semibold [overflow-wrap:anywhere]">
              {draft.fileIssue && draft.name
                ? `${draft.name} · ${receiptSizeText(draft.size ?? 0, language)}`
                : t("receipt.field.upload")}
            </span>
            <span className={cx("text-xs", online ? "text-text-muted" : "text-text-subtle")}>
              {draft.fileIssue ? t("receipt.field.pickAnother") : t("receipt.field.formats")}
            </span>
          </span>
        </Pressable>
      ) : null}

      {working ? (
        <div aria-busy="true" className={cx(ROW, "flex-col items-stretch gap-2.5 border-border-strong")}>
          <div className="flex min-w-0 items-center gap-3">
            <span className="mx-0.5 inline-flex h-13 w-10 shrink-0 items-center justify-center rounded-lg bg-sunken text-text-muted">
              <Spinner size="sm" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className={NAME}>{draft.name}</span>
              <span className="text-xs whitespace-nowrap text-text-muted">
                {draft.status === "uploading"
                  ? t("receipt.field.uploading", { percent: draft.progress })
                  : t("receipt.field.preparing")}
              </span>
            </span>
            <IconButton
              icon={X}
              size="sm"
              variant="ghost"
              label={t("receipt.field.cancel")}
              onClick={receipt.remove}
            />
          </div>
          <div
            role="progressbar"
            aria-label={t("receipt.field.uploadingAria")}
            aria-valuenow={draft.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 overflow-hidden rounded-full bg-sunken"
          >
            <span className="block h-full rounded-full bg-action" style={{ width: `${draft.progress}%` }} />
          </div>
          {compressed ? (
            <span className="text-xs text-text-muted">
              {t("receipt.field.compressed", {
                from: receiptSizeText(draft.size ?? 0, language),
                to: receiptSizeText(draft.bytes ?? 0, language),
              })}
            </span>
          ) : null}
        </div>
      ) : null}

      {draft.status === "uploaded" ? (
        <div className={cx(ROW, "border-border-strong")}>
          <Pressable
            ref={triggerRef}
            aria-haspopup="dialog"
            aria-label={t("receipt.field.zoom")}
            onClick={() => setViewerOpen(true)}
            className="inline-flex min-w-11 shrink-0 cursor-zoom-in justify-center rounded-lg"
          >
            {draft.preview ? (
              <img src={draft.preview} alt="" className="h-13 w-10 rounded-lg border border-border-strong object-cover" />
            ) : (
              <span className="grid h-13 w-10 place-items-center rounded-lg border border-border-strong bg-surface text-text-muted">
                <ImagePlus aria-hidden="true" size={18} />
              </span>
            )}
          </Pressable>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={NAME}>{draft.name}</span>
            <span className="inline-flex items-center gap-1 text-xs whitespace-nowrap text-text-muted">
              <span className="inline-flex items-center gap-1 text-success-fg">
                <CircleCheck aria-hidden="true" size={14} />
                {t("receipt.field.uploaded")}
              </span>
              {draft.bytes !== null ? ` · ${receiptSizeText(draft.bytes, language)}` : null}
            </span>
          </span>
          <span className="flex shrink-0 gap-1">
            <IconButton
              icon={RefreshCw}
              size="sm"
              variant="ghost"
              label={t("receipt.field.replace")}
              disabled={!online}
              onClick={pick}
            />
            <IconButton
              icon={X}
              size="sm"
              variant="ghost"
              label={t("receipt.field.remove")}
              onClick={receipt.remove}
            />
          </span>
        </div>
      ) : null}

      {draft.status === "failed" ? (
        <div className={cx(ROW, "border-danger")}>
          <span className="inline-flex min-w-11 shrink-0 justify-center">
            {draft.preview ? (
              <img src={draft.preview} alt="" className="h-13 w-10 rounded-lg border border-border-strong object-cover" />
            ) : (
              <span className="grid h-13 w-10 place-items-center rounded-lg border border-border-strong bg-surface text-text-muted">
                <ImagePlus aria-hidden="true" size={18} />
              </span>
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={NAME}>{draft.name}</span>
            <span className="flex flex-wrap items-center gap-x-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap text-danger-fg">
                <CircleAlert aria-hidden="true" size={14} />
                {t("receipt.field.failed")}
              </span>
              <Button
                ref={triggerRef}
                variant="link"
                size="sm"
                className="p-0 max-md:min-h-11"
                disabled={!online}
                onClick={receipt.retry}
              >
                {t("receipt.field.retry")}
              </Button>
            </span>
          </span>
          <IconButton
            icon={CircleX}
            size="sm"
            variant="ghost"
            label={t("receipt.field.remove")}
            onClick={receipt.remove}
          />
        </div>
      ) : null}

      <ReceiptViewerDialog
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        src={draft.preview ?? draft.photoUrl}
        openUrl={draft.photoUrl}
        description={viewerDescription}
      />
    </Field>
  );
};

export default ReceiptField;
