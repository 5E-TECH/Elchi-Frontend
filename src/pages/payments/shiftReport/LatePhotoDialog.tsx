// dizayn-v2: (maket yo'q) superadmin-payments-main-cashbox-shift-dialog-accounts
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CircleX, ImagePlus, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  isAccountCommentRequired,
  prepareShiftPhotoWithPreview,
  readShiftLatePhotoError,
  SHIFT_LATE_PHOTO_COMMENT_MAX,
  SHIFT_PHOTO_MIME_TYPES,
  useUploadShiftLatePhoto,
  validateShiftPhoto,
  type ShiftAccountCheck,
} from "../../../entities/payments";
import { cx } from "../../../shared/lib/cx";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import { Button, Dialog, Field, IconButton, TextInput, TONE_SOFT } from "../../../shared/ui/primitives";
import { parseOptionalAmountInput } from "../components/lib/amountInput";
import { ShiftDiffAmount, ShiftDiffBadge } from "../components/ShiftDiff";
import ShiftSummaryList from "../components/ShiftSummaryList";
import { cardSubtitle } from "../components/shiftCheck/aiStatusMeta";
import { toShiftPhotoIssue, type ShiftPhotoIssue } from "../components/shiftCheck/useShiftAccountsForm";
import { useLateDeadlineText } from "./photoStatusMeta";

/**
 * «RASMNI KEYIN YUKLASH» OYNASI (BE-B, ega qarori 2026-11-10) — avtomatik yopilgan ASOSIY kassa smenasida kassir
 * yuklay olmagan karta qoldig'i skrinshoti 24 soat ichida (superadmin / admin, `can_upload_late`). Maket yo'q — eng
 * yaqini `superadmin-payments-main-cashbox-shift-dialog-accounts` (karta qatori: «Ilovadagi qoldiq *», «Skrinshot *»,
 * izoh). Telefonda — pastki varaqa (`Dialog`).
 *
 *  - Sarlavha ostida karta (nomi · bank · ··1234); «Tizim bo'yicha (smena yopilganda)» — snapshot `expected_balance`
 *    (farq shundan hisoblanadi, joriy balansdan emas) va «Muddat» (`late_upload_deadline`).
 *  - «Skrinshot *» — jpeg / png / webp; tanlanishi bilan brauzerda ≤ 5 MB JPEG ga keltiriladi
 *    (`prepareShiftPhotoWithPreview`, smena yopishdagi yo'l) va ko'rinishi chiqadi.
 *  - «Ilovadagi qoldiq *» (`TextInput mode="money"`, `0` ham qiymat) — ostida farq; kiritilgan ≠ tizim bo'yicha bo'lsa
 *    «Izoh *» majburiy (backend qoidasi; kassirning yopishdan oldingi izohi hisobga olinmaydi), ≤ 1000 belgi.
 *  - Rasm, qoldiq va (farq bo'lsa) izoh bo'lmaguncha «Yuklash» o'chiq, sababi tugmalar yonida — uchala majburiy
 *    maydon bir xil qoida bilan.
 *  - Xato (409 `SHIFT_LATE_PHOTO_NOT_AUTO_CLOSED` / `SHIFT_LATE_PHOTO_EXPIRED` + muddat, 404 `…_CARD_NOT_IN_SHIFT`,
 *    400 izoh, 403) — backend matni AYNAN oyna ichida, oyna ochiq qoladi; 409 / 404 da hisobot qayta o'qiladi
 *    (`useUploadShiftLatePhoto`). Qayta urinish foyda bermaydigan xatoda «Yuklash» va maydonlar o'chadi — faqat
 *    xato matni va «Bekor qilish» qoladi.
 *  - 201 — «Rasm yuklandi», oyna yopiladi, hisobot qatori javobdagi qator bilan almashadi va qayta o'qiladi.
 */

const PHOTO_ACCEPT = SHIFT_PHOTO_MIME_TYPES.join(",");

type PickedPhoto = { file: File; preview: string; name: string };
type ServerError = { message: string; deadline: string | null; terminal: boolean };

type LatePhotoDialogProps = {
  open: boolean;
  shiftId: string;
  /** Tanlangan karta qatori (hisobotdan — jonli). Yopilish harakati paytida oxirgisi saqlanadi. */
  row: ShiftAccountCheck | null;
  onClose: () => void;
  onExited?: () => void;
};

const LatePhotoDialog = ({ open, shiftId, row, onClose, onExited }: LatePhotoDialogProps) => {
  const { t, i18n } = useTranslation("payments");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const upload = useUploadShiftLatePhoto();
  const untilText = useLateDeadlineText();
  const inputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const reasonId = useId();

  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [photoIssue, setPhotoIssue] = useState<ShiftPhotoIssue | null>(null);
  const [enteredInput, setEnteredInput] = useState("");
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<ServerError | null>(null);
  /** Backend 400 «… izoh majburiy» dedi — mijoz farqni ko'rmasa ham izoh so'raladi. */
  const [forceComment, setForceComment] = useState(false);

  const reset = () => {
    setPhoto(null);
    setPreparing(false);
    setPhotoIssue(null);
    setEnteredInput("");
    setComment("");
    setSubmitted(false);
    setServerError(null);
    setForceComment(false);
    upload.reset();
  };

  const cardName = row?.card?.name ?? (row ? `#${row.card_id}` : "");
  const subtitle = cardSubtitle(row?.card);
  const cardLabel = [cardName, subtitle].filter(Boolean).join(" · ");
  const expected = row?.expected_balance ?? null;
  const entered = parseOptionalAmountInput(enteredInput);
  const difference = entered !== null && expected !== null ? entered - expected : null;
  const commentRequired =
    forceComment || isAccountCommentRequired({ difference, ai_status: null, ai_entered_ok: null });
  const commentMissing = commentRequired && !comment.trim();
  const ready = Boolean(photo) && entered !== null && !preparing;
  const blocked = serverError?.terminal ?? false;
  const deadline = untilText(row?.late_upload_deadline ?? null);
  const busy = upload.isPending;

  // Xato oyna tanasining tepasida — telefonda tana pastga aylangan bo'ladi: xato ko'rinishga suriladi.
  useEffect(() => {
    if (serverError) errorRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [serverError]);

  const blockReason = blocked
    ? null
    : !photo && entered === null
      ? t("shiftCheck.report.late.needBoth")
      : !photo
        ? t("shiftCheck.report.late.needPhoto")
        : entered === null
          ? t("shiftCheck.report.late.needBalance")
          : commentMissing
            ? t("shiftCheck.report.late.needComment")
            : null;
  /** Maydonlar: yuborilayotganda yoki qayta urinish foydasiz xatodan keyin o'chiq. */
  const locked = busy || blocked;

  const pickPhoto = async (file: File) => {
    setPhotoIssue(null);
    setPreparing(true);
    try {
      // Telefon surati ko'pincha 5 MB dan katta — avval kichraytiriladi, keyin tur / hajm tekshiriladi.
      const prepared = await prepareShiftPhotoWithPreview(file);
      const invalid = validateShiftPhoto(prepared.file);
      if (invalid) {
        setPhotoIssue(invalid);
        return;
      }
      setPhoto({ file: prepared.file, preview: prepared.preview, name: file.name });
    } catch (error) {
      setPhotoIssue(toShiftPhotoIssue(error) ?? "decode");
    } finally {
      setPreparing(false);
    }
  };

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!row || !photo || entered === null || preparing || busy || blocked) return;
    setSubmitted(true);
    if (commentMissing) return;
    setServerError(null);
    try {
      await upload.mutateAsync({ shiftId, cardId: row.card_id, photo: photo.file, enteredBalance: entered, comment });
      notify.success(t("shiftCheck.accounts.uploaded"), { description: cardLabel });
      onClose();
    } catch (error) {
      const info = readShiftLatePhotoError(error);
      setServerError({
        message: info.message ?? t("shiftCheck.accounts.errors.upload"),
        deadline: info.deadline,
        terminal: info.terminal,
      });
      if (info.commentRequired) {
        setForceComment(true);
        setSubmitted(true);
      }
    }
  };

  const photoError =
    photoIssue === "type"
      ? t("shiftCheck.accounts.errors.photoType")
      : photoIssue === "size"
        ? t("shiftCheck.accounts.errors.photoSize")
        : photoIssue === "heic"
          ? t("shiftCheck.accounts.errors.photoHeic")
          : photoIssue === "decode"
            ? t("shiftCheck.accounts.errors.photoDecode")
            : undefined;
  const sizeText = photo
    ? `${formatNumberLocalized(Math.max(1, Math.round(photo.file.size / 1024)), { language })} KB`
    : "";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onExited={() => {
        reset();
        onExited?.();
      }}
      busy={busy}
      size="md"
      icon={ImagePlus}
      title={t("shiftCheck.report.late.title")}
      description={cardLabel || undefined}
      onSubmit={(event) => void handleSubmit(event)}
      formProps={{ noValidate: true }}
      footer={
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-x-4 gap-y-2">
          {blockReason ? (
            <p
              id={reasonId}
              role="status"
              data-testid="late-photo-block-reason"
              className="m-0 min-w-0 flex-1 basis-48 text-[13px] text-text-muted max-md:basis-full max-md:text-center"
            >
              {blockReason}
            </p>
          ) : null}
          <div className="flex shrink-0 gap-2 max-md:w-full max-md:[&>button]:flex-1">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              {t("v2MainCashbox.shift.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!ready || blocked || commentMissing}
              loading={busy}
              loadingText={t("shiftCheck.accounts.uploading")}
              aria-describedby={blockReason ? reasonId : undefined}
            >
              {t("shiftCheck.report.late.submit")}
            </Button>
          </div>
        </div>
      }
    >
      {serverError ? (
        <div
          ref={errorRef}
          role="alert"
          data-testid="late-photo-error"
          className={cx("flex min-w-0 items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT.danger)}
        >
          <CircleX aria-hidden="true" size={18} className="mt-px shrink-0" />
          <span className="flex min-w-0 flex-col gap-0.5 text-text">
            <span className="font-semibold">{serverError.message}</span>
            {serverError.deadline ? (
              <span>
                {t("shiftCheck.report.late.deadlineWas", {
                  time: formatDateTimeLocalized(serverError.deadline, { language }),
                })}
              </span>
            ) : null}
          </span>
        </div>
      ) : null}

      <ShiftSummaryList
        label={t("shiftCheck.report.late.summary")}
        rows={[
          {
            key: "expected",
            label: t("shiftCheck.report.late.expected"),
            value: (
              <span className="whitespace-nowrap">
                {expected === null ? "—" : formatMoneyLocalized(expected, { language })}
              </span>
            ),
          },
          ...(deadline
            ? [{ key: "deadline", label: t("shiftCheck.report.late.deadline"), value: deadline, plain: true }]
            : []),
        ]}
      />

      <Field label={t("shiftCheck.accounts.photo")} labelAs="span" required error={photoError}>
        <div className="flex min-w-0 flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={PHOTO_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="late-photo-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void pickPhoto(file);
            }}
          />
          {photo && !preparing ? (
            <>
              <img
                src={photo.preview}
                alt={t("shiftCheck.report.late.previewAlt", { card: cardName })}
                className="max-h-48 w-full rounded-[10px] border border-border bg-sunken object-contain"
              />
              <div className="flex min-h-11 min-w-0 items-center gap-3 rounded-[10px] border border-border bg-surface px-3 py-1.5">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-text">{photo.name}</span>
                  <span className="text-xs text-text-muted">{sizeText}</span>
                </span>
                <IconButton
                  icon={RefreshCw}
                  size="sm"
                  variant="ghost"
                  label={t("shiftCheck.accounts.replace")}
                  onClick={() => inputRef.current?.click()}
                  disabled={locked}
                />
              </div>
            </>
          ) : (
            <Button
              variant="secondary"
              leftIcon={ImagePlus}
              className="w-full"
              onClick={() => inputRef.current?.click()}
              loading={preparing}
              loadingText={t("shiftCheck.report.late.preparing")}
              disabled={locked}
            >
              {t("shiftCheck.report.late.choose")}
            </Button>
          )}
        </div>
      </Field>

      <div className="flex min-w-0 flex-col gap-1.5">
        <Field
          label={t("shiftCheck.accounts.entered")}
          required
          hint={
            <>
              {t("shiftCheck.accounts.system")}{" "}
              <span className="whitespace-nowrap font-semibold text-text">
                {expected === null ? "—" : formatMoneyLocalized(expected, { language })}
              </span>
            </>
          }
        >
          <TextInput
            mode="money"
            value={enteredInput}
            onValueChange={setEnteredInput}
            placeholder="0"
            autoComplete="off"
            disabled={locked}
          />
        </Field>
        {difference !== null ? (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 rounded-[10px] bg-sunken px-3 py-2"
          >
            <span className="text-[13px] text-text-muted">{t("v2MainCashbox.shift.close.diff")}</span>
            <span className="inline-flex flex-wrap items-center gap-2">
              <ShiftDiffAmount diff={difference} className="text-sm" />
              <ShiftDiffBadge diff={difference} />
            </span>
          </div>
        ) : null}
      </div>

      <Field
        label={t("shiftCheck.accounts.comment")}
        required={commentRequired}
        optional={!commentRequired}
        hint={commentRequired ? t("shiftCheck.report.late.commentHint") : undefined}
        hintAside={
          <span className="whitespace-nowrap">
            {formatNumberLocalized(comment.length, { language })} /{" "}
            {formatNumberLocalized(SHIFT_LATE_PHOTO_COMMENT_MAX, { language })}
          </span>
        }
        error={submitted && commentMissing ? t("shiftCheck.report.late.commentError") : undefined}
      >
        <TextInput
          multiline
          rows={3}
          maxLength={SHIFT_LATE_PHOTO_COMMENT_MAX}
          value={comment}
          onValueChange={setComment}
          disabled={locked}
          placeholder={
            commentRequired
              ? t("shiftCheck.accounts.commentPlaceholder")
              : t("shiftCheck.accounts.commentOptionalPlaceholder")
          }
        />
      </Field>

      <p className="m-0 text-[13px] text-text-muted">{t("shiftCheck.report.late.note")}</p>
    </Dialog>
  );
};

export default LatePhotoDialog;
