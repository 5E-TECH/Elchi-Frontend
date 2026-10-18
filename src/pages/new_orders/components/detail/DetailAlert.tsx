// dizayn-v2: superadmin-orders-detail, manager-orders-detail, market-orders-detail, courier-orders-detail
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "../../../../shared/lib/cx";
import { TONE_RING, TONE_SOFT } from "../../../../shared/ui/primitives";

/**
 * Sahifa ogohlantirishi — maketdagi `.el-alert` (CODE-MAP 2.7): ikonka + qalin sarlavha + matn.
 * Tonlar: `warning` (market tasdig'i kutilmoqda), `neutral` (qulf: chegarali sunken), `info`
 * (marketda «Faqat ko'rish uchun», qisman sotuv banneri), `success` (bekor qilinganlarni topshirish:
 * «Market QR skanerlandi»).
 *
 * `aside` — o'ng ustun (masalan QR amal qilish taymeri, maket `superadmin-neworders-cancelled-handover`):
 * matn bloki `flex: 1 1 320px`, joy yetmasa (telefonda) `aside` matn ostiga tushadi. `aside` berilmasa
 * tuzilma avvalgidek (bitta qator: ikonka + matn).
 */
type DetailAlertProps = {
  tone: "warning" | "neutral" | "info" | "success";
  icon: LucideIcon;
  /** Qalin sarlavha: matn bilan bir qatorda (`.el-alert-title` span) yoki alohida qatorda (`titleBlock`). */
  title?: ReactNode;
  titleBlock?: boolean;
  children?: ReactNode;
  /** O'ng ustun (taymer va h.k.); telefonda matn ostiga tushadi. */
  aside?: ReactNode;
  id?: string;
  role?: "status" | "note" | "alert";
  /** Telefondagi ixcham ko'rinish (`courier-orders-detail`: 10×12 chekka, 13px). */
  compact?: boolean;
  className?: string;
  "data-testid"?: string;
};

export const DetailAlert = ({
  tone,
  icon: Icon,
  title,
  titleBlock = false,
  children,
  aside,
  id,
  role,
  compact = false,
  className,
  "data-testid": testId,
}: DetailAlertProps) => {
  const icon = <Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0" />;
  const body = (
    <div className="min-w-0 flex-1 text-text">
      {title ? (
        titleBlock ? (
          <div className="font-bold">{title}</div>
        ) : (
          <>
            <span className="font-bold">{title}</span>{" "}
          </>
        )
      ) : null}
      {children}
    </div>
  );

  return (
    <div
      id={id}
      role={role}
      data-testid={testId}
      className={cx(
        // `aside` siz — klasslar avvalgidek (bitta qator); `aside` bilan — o'raladigan ikki ustun.
        aside != null ? "flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl" : "flex items-start rounded-xl",
        aside != null
          ? compact
            ? "px-3 py-2.5 text-[13px]"
            : "px-4 py-3 text-sm"
          : compact
            ? "gap-2 px-3 py-2.5 text-[13px]"
            : "gap-3 px-4 py-3 text-sm",
        TONE_SOFT[tone],
        tone === "neutral" && TONE_RING.neutral,
        className,
      )}
    >
      {aside != null ? (
        <>
          <div className={cx("flex min-w-0 flex-[1_1_320px] items-start", compact ? "gap-2" : "gap-3")}>
            {icon}
            {body}
          </div>
          <div className="flex-none">{aside}</div>
        </>
      ) : (
        <>
          {icon}
          {body}
        </>
      )}
    </div>
  );
};
