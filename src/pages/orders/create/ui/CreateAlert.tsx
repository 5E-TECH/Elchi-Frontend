// dizayn-v2: superadmin-neworders-create-manual-step2, superadmin-neworders-create-ai-input, superadmin-neworders-create-ai-preview, market-new-orders-create-manual
import type { ReactNode } from "react";
import { CircleCheck, CircleX, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cx } from "../../../../shared/lib/cx";
import { TONE_SOFT } from "../../../../shared/ui/primitives";

export type CreateAlertTone = "info" | "success" | "warning" | "danger";

export type CreateAlertProps = {
  /** Ma'no rangi: `info` (ko'rsatma), `success` (natija), `warning` (to'siq), `danger` (xato). */
  tone: CreateAlertTone;
  /** Qalin sarlavha (`.el-alert-title`) — alohida qatorda. */
  title?: ReactNode;
  /** Matn (`.el-alert-body .el-small`, 13 px). */
  children?: ReactNode;
  /** Matn ostidagi amal — odatda `<Button variant="secondary" size="sm">` («Qo'lda yaratish»). */
  action?: ReactNode;
  /** Ikonka (sukut — tonga qarab: `Info`, `CircleCheck`, `TriangleAlert`, `CircleX`). */
  icon?: LucideIcon;
  /** Sukut: `danger` → `alert`, qolganlari → `status`. */
  role?: "status" | "alert";
  id?: string;
  className?: string;
  "data-testid"?: string;
};

const DEFAULT_ICON: Record<CreateAlertTone, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleX,
};

/**
 * SAHIFA OGOHLANTIRISHI — maketdagi `.el-alert` (CODE-MAP 2.7): ton foni, ton rangidagi ikonka (18 px),
 * qalin sarlavha, 13 px matn va ixtiyoriy amal. Matn neytral (`text-text`) — faqat ikonka ton rangida.
 *
 *   <CreateAlert tone="danger" title={t("orderCreateErrorTitle")}>{serverError}</CreateAlert>
 *   <CreateAlert tone="warning" title="AI hozir o'chiq" action={<Button variant="secondary" size="sm" …/>}>…</CreateAlert>
 *   <CreateAlert tone="success" title="2 ta yaratildi" />
 *
 * Maketlar: `*-neworders-create-manual-step2` («Server xatosi»), `*-create-ai-input` (to'siq va xatolar),
 * `*-create-ai-preview` (natija). Umumiy primitiv emas — shu sahifa ichida (AI va qo'lda qism birga ishlatadi).
 */
export const CreateAlert = ({
  tone,
  title,
  children,
  action,
  icon,
  role,
  id,
  className,
  "data-testid": testId,
}: CreateAlertProps) => {
  const Icon = icon ?? DEFAULT_ICON[tone];
  const hasTitle = title !== undefined && title !== null && title !== false && title !== "";
  const hasBody = children !== undefined && children !== null && children !== false && children !== "";

  return (
    <div
      id={id}
      role={role ?? (tone === "danger" ? "alert" : "status")}
      data-testid={testId}
      data-tone={tone}
      className={cx("flex min-w-0 items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT[tone], className)}
    >
      <Icon size={18} aria-hidden="true" className="mt-px shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-text">
        {hasTitle ? <div className="font-bold">{title}</div> : null}
        {hasBody ? <div className="text-[13px] leading-[18px] wrap-break-word">{children}</div> : null}
        {action ? <div className="flex flex-wrap gap-2 pt-1">{action}</div> : null}
      </div>
    </div>
  );
};

export default CreateAlert;
