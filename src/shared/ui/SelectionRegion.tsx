// dizayn-v2: superadmin-neworders-market-orders, admin-neworders-market-detail, manager-new-orders-market-detail, registrator-new-orders-market-detail, superadmin-neworders-branch-batches, admin-neworders-branch-batches, superadmin-neworders-branch-batch-detail, admin-neworders-branch-batch-detail, superadmin-neworders-cancelled-handover, admin-neworders-cancelled-detail, registrator-new-orders-cancelled-detail
import type { ReactNode } from "react";
import { cx } from "../lib/cx";

/**
 * TANLOV PANELI — kartadagi `role="region"` «Tanlanganlar» qatori (`bg-action-soft`, maketlar
 * `superadmin-neworders-branch-batches`, `superadmin-neworders-branch-batch-detail`, bekor qilinganlarni topshirish;
 * market buyurtmalari — `marketOrders/SelectionBar.tsx` orqali; pochta tafsiloti va paket buyurtmalari —
 * `pages/mails/detail/ui/OrdersTable.tsx`; qaytarish so'rovlari — `pages/mails/components/returnMails.tsx`).
 * Bir nechta sahifa ishlatgani uchun `shared/ui` da turadi (avval `pages/new_orders/ui` da edi).
 *
 * Chapda: sarlavha («2 ta paket tanlandi · 7 135 000 so'm», `aria-live` — skaner tanlaganda ekran o'quvchi
 * aytadi) va izoh; o'ngda ixtiyoriy amal(lar) («Barchasini tanlash»; telefonda chekka 16, amal alohida qatorda).
 *
 *  - `inline` — sarlavha va izoh bitta qatorda (sig'masa o'raladi; maket `*-cancelled-handover`);
 *    sukut — ustma-ust (filial paketlari maketlari).
 * Sarlavha `text-sm` — maketdagi `el-strong` (14 px, sahifa matni o'lchami).
 *
 *  - `idle` — hali hech narsa tanlanmagan: `bg-sunken`, sarlavha oddiy matn rangida (maket
 *    `*-cancelled-scanner-dialog` «Hali buyurtma tanlanmagan»; ko'k faqat tanlov bo'lganda). Filial paketlari va
 *    market buyurtmalari ham shu holatni ishlatadi — bo'sh tanlov hamma joyda bir xil ko'rinadi.
 */
export type SelectionRegionProps = {
  /** Hudud nomi (`aria-label`), masalan «Tanlanganlar». */
  label: string;
  /** Tanlov xulosasi — o'zgarsa e'lon qilinadi (`aria-live="polite"`). */
  title: ReactNode;
  hint: ReactNode;
  action?: ReactNode;
  inline?: boolean;
  idle?: boolean;
};

export const SelectionRegion = ({ label, title, hint, action, inline = false, idle = false }: SelectionRegionProps) => (
  <div
    role="region"
    aria-label={label}
    className={cx(
      "flex flex-wrap items-center gap-x-4 border-t border-border px-5 py-3 max-md:px-4",
      inline ? "gap-y-1" : "gap-y-2",
      idle ? "bg-sunken" : "bg-action-soft",
    )}
  >
    <div
      className={cx(
        "flex min-w-0",
        inline ? "flex-wrap items-center gap-x-4 gap-y-1" : "flex-[1_1_280px] flex-col gap-0.5",
      )}
    >
      <span className={cx("text-sm font-semibold", idle ? "text-text" : "text-action-fg")} aria-live="polite">
        {title}
      </span>
      <span className="text-xs text-text-muted">{hint}</span>
    </div>
    {action ? <div className="flex flex-wrap items-center gap-2 max-md:w-full">{action}</div> : null}
  </div>
);
