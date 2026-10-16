// dizayn-v2: courier-orders-sell-dialog, courier-orders-sell-partial-dialog, courier-orders-sell-extra-cost-dialog, courier-orders-cancel-dialog, courier-orders-action-approval-pending, courier-orders-rollback-confirm, manager-orders-sell-dialog, manager-orders-cancel-dialog, manager-orders-rollback-dialog
import { useId, type ReactNode } from "react";
import { Camera, CircleCheck, User, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../../../shared/lib/cx";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../../../shared/lib/formatMoney";
import { formatPhone } from "../../../../../shared/lib/formatPhone";
import { buttonClasses, ButtonIcon, Field, IconButton, useFieldControl } from "../../../../../shared/ui/primitives";
import { getInitials, MAX_PROOF_SIZE_MB, type ActionOrder, type OrderActionVariant } from "./orderActionModel";

/**
 * Buyurtma amallari oynalarining umumiy bloklari: mijoz kartasi va dalil (rasm/video) maydoni.
 * Maketlar: `courier-orders-*-dialog` (avatar, dashed quti) va `manager-orders-*-dialog`
 * (ikonkali blok, tanlangan fayl — chegarali qator + «Faylni olib tashlash»).
 */

/** `.el-stat-icon` (36, `surface` fon) — menejer oynasidagi mijoz ikonkasi, dalil ikonkasi. */
const STAT_ICON = "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px]";

type CustomerSummaryProps = {
  order: ActionOrder;
  variant: OrderActionVariant;
  /** Pastki qism (qaytarish oynasidagi «Holat» qatori) — o'sha `sunken` blok ichida, chiziq bilan. */
  footer?: ReactNode;
  /** Mijoz ostidagi qator (sukut: telefon · tuman). */
  meta?: ReactNode;
  /** Mijoz ostidagi qator o'rami klassi (sukut oraliq `gap-x-3`; ajratgichli qator — torroq). */
  metaClassName?: string;
  /** O'ngdagi summa ustidagi yorliq (sukut «Jami summa»; `null` — yorliqsiz). */
  amountLabel?: ReactNode | null;
};

/**
 * Mijoz kartasi: ism, telefon va tuman, o'ngda jami summa (`sunken` blok, `role="group"` «Mijoz»).
 * Kuryer — bosh harfli avatar; menejer — `User` ikonkasi, telefonda summa pastga o'raladi.
 */
export const OrderCustomerSummary = ({ order, variant, footer, meta, metaClassName, amountLabel }: CustomerSummaryProps) => {
  const { t, i18n } = useTranslation("orders");
  const name = order.customer?.name?.trim() || "—";
  const phone = order.customer?.phone_number ? formatPhone(order.customer.phone_number) : null;
  const district = order.district?.name?.trim() || null;
  const label = amountLabel === undefined ? t("sumLabel") : amountLabel;

  const subline = meta ?? (
    <>
      {phone ? <span className="whitespace-nowrap">{phone}</span> : null}
      {district ? <span className="whitespace-nowrap">{district}</span> : null}
    </>
  );

  const amount = (
    <div className={cx("flex shrink-0 flex-col gap-0.5 text-right", variant === "manager" && "ml-auto")}>
      {label != null ? <span className="text-xs text-text-muted">{label}</span> : null}
      <span className="whitespace-nowrap text-sm font-semibold text-text">
        {formatMoneyLocalized(Number(order.total_price) || 0, { language: i18n.language })}
      </span>
    </div>
  );

  const person = (
    <>
      {variant === "manager" ? (
        <span aria-hidden="true" className={cx(STAT_ICON, "bg-surface text-text-muted")}>
          <User size={18} strokeWidth={2} />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-avatar text-[13px] font-bold text-on-avatar"
        >
          {getInitials(order.customer?.name)}
        </span>
      )}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold text-text">{name}</span>
        <span className={cx("flex flex-wrap text-[13px] text-text-muted", metaClassName ?? "gap-x-3")}>{subline}</span>
      </div>
    </>
  );

  const row =
    variant === "manager" ? (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
        <div className="flex min-w-0 flex-[1_1_200px] items-center gap-3">{person}</div>
        {amount}
      </div>
    ) : (
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">{person}</div>
        {amount}
      </div>
    );

  return (
    <div role="group" aria-label={t("customer")} className="flex min-w-0 flex-col rounded-xl bg-sunken text-sm">
      {row}
      {footer ? <div className="border-t border-border px-4 py-3">{footer}</div> : null}
    </div>
  );
};

type ProofFieldProps = {
  variant: OrderActionVariant;
  file: File | null;
  required: boolean;
  /** Tanlanmagan holatdagi izoh (majburiylik sababi) — `Field hint`. */
  hint?: ReactNode;
  error?: ReactNode;
  onFileChange: (file: File | undefined) => void;
};

/**
 * Dalil maydoni — «Rasm yoki video» (`Field`, yorliq `span`: boshqaruv yashirin `input[type=file]`).
 * Bo'sh — punktir quti «Rasm/video yuklash · Tanlash». Tanlangan: kuryer — o'sha qutida yashil
 * belgi + «Almashtirish»; menejer — chegarali qator, «Almashtirish» va «Faylni olib tashlash».
 */
export const ProofField = ({ variant, file, required, hint, error, onFileChange }: ProofFieldProps) => {
  const { t, i18n } = useTranslation("orders");
  const inputId = useId();
  const size = file
    ? `${formatNumberLocalized(file.size / (1024 * 1024), { language: i18n.language, fractionDigits: 1 })} MB`
    : null;

  const input = (labelId: string | undefined, describedBy: string | undefined) => (
    <input
      id={inputId}
      type="file"
      accept="image/*,video/*"
      className="sr-only"
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      aria-required={required || undefined}
      aria-invalid={error ? true : undefined}
      onChange={(event) => {
        onFileChange(event.target.files?.[0]);
        // Bir xil faylni qayta tanlash ham `change` bersin (olib tashlangandan keyin).
        event.target.value = "";
      }}
    />
  );

  const managerChosen = variant === "manager" && file;

  return (
    <Field
      label={t("mediaProof")}
      labelAs="span"
      required={required}
      optional={!required}
      hint={hint}
      error={error}
    >
      <FieldBox>
        {({ labelId, describedBy }) =>
          managerChosen ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border-strong bg-input px-3 py-2.5">
              <label
                htmlFor={inputId}
                className="flex min-w-0 flex-[1_1_200px] cursor-pointer items-center gap-3 rounded-lg focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-action"
              >
                <span aria-hidden="true" className={cx(STAT_ICON, "bg-sunken text-text-muted")}>
                  <Camera size={18} strokeWidth={2} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold text-text">{file.name}</span>
                  <span className="text-xs text-text-muted">
                    {size} · {t(file.type.startsWith("video/") ? "mediaProofKindVideo" : "mediaProofKindImage")}
                  </span>
                </span>
                <span aria-hidden="true" className={buttonClasses({ variant: "ghost", size: "sm", className: "ml-auto" })}>
                  {t("mediaProofReplace")}
                </span>
                {input(labelId, describedBy)}
              </label>
              <IconButton size="sm" icon={X} label={t("mediaProofRemove")} onClick={() => onFileChange(undefined)} />
            </div>
          ) : (
            <label
              className={cx(
                "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed bg-sunken p-3",
                "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-action",
                error ? "border-danger" : "border-border-strong",
              )}
            >
              <span
                aria-hidden="true"
                className={cx(STAT_ICON, file ? "bg-success-soft text-success-fg" : "bg-surface text-text-muted")}
              >
                <ButtonIcon icon={file ? CircleCheck : Camera} px={18} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-semibold text-text">
                  {/* Maketlar: kuryer «Rasm/video yuklash», menejer «Rasm yoki video yuklash». */}
                  {file ? file.name : t(variant === "manager" ? "mediaProofUploadFull" : "mediaProofUpload")}
                </span>
                <span className="text-xs text-text-muted">
                  {file
                    ? `${size} · ${t("mediaProofSizeLimit", { size: MAX_PROOF_SIZE_MB })}`
                    : t("mediaProofHint", { size: MAX_PROOF_SIZE_MB })}
                </span>
              </span>
              <span aria-hidden="true" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                {file ? t("mediaProofReplace") : t("mediaProofChoose")}
              </span>
              {input(labelId, describedBy)}
            </label>
          )
        }
      </FieldBox>
    </Field>
  );
};

/** `Field` kontekstidan yorliq va izoh `id` lari (yashirin fayl maydoni `Field` ichida, lekin `TextInput` emas). */
const FieldBox = ({
  children,
}: {
  children: (ids: { labelId: string | undefined; describedBy: string | undefined }) => ReactNode;
}) => {
  const control = useFieldControl();
  return <>{children({ labelId: control.labelId, describedBy: control["aria-describedby"] })}</>;
};
