// dizayn-v2: (maket yo'q) courier-orders-sell-dialog
import { memo, useEffect, useRef } from "react";
import { TriangleAlert } from "lucide-react";

/**
 * Amal rad etildi (2KisY7DL) — backend sababi sotish / bekor qilish oynasi ichida. Maketda xato holati yo'q:
 * ko'rinishi `ExtraCostNoticeAlert` dagi `.el-alert`, ton — danger.
 */
export const OrderActionErrorAlert = memo(({ message }: { message: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  // Telefonda pastki varaqa uzun bo'lsa sabab tanasining oxirida, ko'rinmay qolardi — chiqqanda ko'rinishga suriladi.
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: "nearest" });
  }, [message]);

  return (
    <div
      ref={ref}
      role="alert"
      className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-[13px] text-danger-fg"
    >
      <TriangleAlert className="mt-0.5 size-4 flex-none" aria-hidden="true" />
      <p className="min-w-0 text-text">{message}</p>
    </div>
  );
});
OrderActionErrorAlert.displayName = "OrderActionErrorAlert";
