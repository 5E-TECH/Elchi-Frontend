// dizayn-v2: superadmin-payments-cashbox-account-form-dialog
import { useId, type ReactNode } from "react";
import { CircleX, CreditCard, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type { CashboxCardKind } from "../../../../entities/payments/cashboxCards";
import { cx } from "../../../../shared/lib/cx";
import { Pressable } from "../../../../shared/ui/primitives";
import { CARD_KIND_ICON } from "./cardMeta";

/**
 * KARTA OYNALARINING KICHIK BO'LAKLARI (cards1111): turi ikonkasi qutisi, ogohlantirish qutisi (`.el-alert`),
 * kalit qatori (`.el-switch`, `pages/settings` dagi `SwitchRow` retsepti — sahifalararo import qilinmaydi, FSD).
 */

/** Turi ikonkasi qutisi (maket `.el-acc-ico`: 36 px, `sunken` fon, 18 px ikonka). */
export const CardKindTile = ({ kind, className }: { kind: CashboxCardKind | null; className?: string }) => {
  const Icon = kind ? CARD_KIND_ICON[kind] : CreditCard;
  return (
    <span
      aria-hidden="true"
      className={cx("inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted", className)}
    >
      <Icon size={18} strokeWidth={2} />
    </span>
  );
};

type NoticeTone = "danger" | "warning" | "info" | "neutral";

const NOTICE_TONE: Record<NoticeTone, { box: string; icon: LucideIcon }> = {
  // Reestr: xato — `CircleX` (`Field` xatosi bilan bir xil).
  danger: { box: "bg-danger-soft text-danger-fg", icon: CircleX },
  warning: { box: "bg-warning-soft text-warning-fg", icon: TriangleAlert },
  info: { box: "bg-info-soft text-info-fg", icon: Info },
  neutral: { box: "bg-sunken text-text-muted", icon: Info },
};

/** Ogohlantirish qutisi (`.el-alert`); `alert` — `role="alert"` (backend rad etdi: darhol o'qiladi). */
export const CardNotice = ({
  tone = "neutral",
  icon,
  children,
  className,
  id,
  alert = false,
}: {
  tone?: NoticeTone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  id?: string;
  alert?: boolean;
}) => {
  const Icon = icon ?? NOTICE_TONE[tone].icon;
  return (
    <div
      id={id}
      role={alert ? "alert" : undefined}
      className={cx("flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13px] leading-5", NOTICE_TONE[tone].box, className)}
    >
      <Icon aria-hidden="true" size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
};

/** `.el-switch` (36 × 20): yoqiq — `action`, o'chiq — `border-strong`. Holat — ota `role="switch"` dagi `aria-checked`. */
const SwitchTrack = () => (
  <span
    aria-hidden="true"
    className={cx(
      "relative h-5 w-9 flex-none rounded-full bg-border-strong transition-colors duration-150 motion-reduce:transition-none",
      "group-aria-checked:bg-action group-disabled:opacity-45",
    )}
  >
    <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-on-solid transition-transform duration-150 group-aria-checked:translate-x-4 motion-reduce:transition-none" />
  </span>
);

/** Kalit qatori: butun qator — `role="switch"` tugma, nomi sarlavhadan, izoh `aria-describedby`. Telefonda ≥ 44 px. */
export const CardSwitchRow = ({
  title,
  hint,
  checked,
  disabled,
  onToggle,
}: {
  title: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
}) => {
  const titleId = useId();
  const hintId = useId();
  return (
    <Pressable
      role="switch"
      aria-checked={checked}
      aria-labelledby={titleId}
      aria-describedby={hint ? hintId : undefined}
      disabled={disabled}
      onClick={() => onToggle(!checked)}
      className={cx(
        "group flex min-h-11 w-full items-center gap-3 py-2.5 text-left",
        "disabled:cursor-not-allowed",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span id={titleId} className="text-sm font-semibold text-text">
          {title}
        </span>
        {hint ? (
          <span id={hintId} className="text-[13px] text-text-muted">
            {hint}
          </span>
        ) : null}
      </span>
      <SwitchTrack />
    </Pressable>
  );
};
