// dizayn-v2: superadmin-integrations-partners-console, superadmin-integrations-panel-settlement, superadmin-integrations-panel-security
import type { ReactNode } from "react";
import { CircleCheck, CircleX, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cx } from "../../../shared/lib/cx";
import { TONE_RING, TONE_SOFT, type Tone } from "../../../shared/ui/primitives";

export type InlineAlertProps = {
  /** Ma'no rangi: `info` (ko'rsatma), `success` (natija), `warning` (to'siq), `danger` (xato), `neutral`. */
  tone: Tone;
  /** Qalin sarlavha (`.el-alert-title`). */
  title?: ReactNode;
  /** Matn (13 px). */
  children?: ReactNode;
  /** O'ngdagi amal (masalan «Qayta urinish») — telefonda matn ostiga tushadi. */
  action?: ReactNode;
  /** Sukut — tonga qarab: `Info`, `CircleCheck`, `TriangleAlert`, `CircleX`. */
  icon?: LucideIcon;
  /** Sukut: `danger` → `alert`, qolganlari → `status`. */
  role?: "status" | "alert";
  className?: string;
  "data-testid"?: string;
};

const DEFAULT_ICON: Record<Tone, LucideIcon> = {
  neutral: Info,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleX,
};

const has = (node: ReactNode) => node !== undefined && node !== null && node !== false && node !== "";

/**
 * OGOHLANTIRISH QATORI — maketdagi `.el-alert` (CODE-MAP 2.7): ton foni, ton rangidagi ikonka (18 px),
 * qalin sarlavha, 13 px neytral matn va ixtiyoriy amal (o'ngda; joy yetmasa — ostida).
 *
 * Integratsiyalar bo'limining barcha sahifalari (konsol panellari, katalog, usta) shu bitta
 * komponentdan foydalanadi — umumiy primitiv emas.
 */
export const InlineAlert = ({ tone, title, children, action, icon, role, className, "data-testid": testId }: InlineAlertProps) => {
  const Icon = icon ?? DEFAULT_ICON[tone];
  return (
    <div
      role={role ?? (tone === "danger" ? "alert" : "status")}
      data-testid={testId}
      data-tone={tone}
      className={cx(
        "flex min-w-0 flex-wrap items-start gap-x-3 gap-y-2 rounded-xl px-4 py-3 text-sm",
        TONE_SOFT[tone],
        tone === "neutral" && TONE_RING.neutral,
        className,
      )}
    >
      <Icon size={18} aria-hidden="true" className="mt-px shrink-0" />
      <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1 text-text">
        {has(title) ? <div className="font-bold wrap-break-word">{title}</div> : null}
        {has(children) ? <div className="text-[13px] leading-[18px] wrap-break-word">{children}</div> : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2 max-md:w-full max-md:pl-[30px]">{action}</div> : null}
    </div>
  );
};

export default InlineAlert;
