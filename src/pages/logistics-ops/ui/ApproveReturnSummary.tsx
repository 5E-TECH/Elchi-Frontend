// dizayn-v2: superadmin-ops-logistics-approve-dialog
import { useEffect, useRef } from "react";
import { Lock, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Badge } from "../../../shared/ui/primitives";
import { groupReturnRequestRowsByCourier, type ReturnRequestRow } from "../lib/returnRequestRows";

/** Har kuryer ostida ko'rsatiladigan buyurtmalar soni (qolgani — «+ yana N ta»), maket bo'yicha. */
const VISIBLE_ORDERS = 3;

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? "")
    .join("");

/**
 * Qaytarish so'rovlarini tasdiqlash oynasining mazmuni (maket `superadmin-ops-logistics-approve-dialog`):
 * «Buyurtmalar N ta», «Kuryerlar M ta (+ K ta buyurtma kuryersiz)», kuryer guruhlari (avatar, ism, son,
 * birinchi 3 buyurtma va holati, «+ yana N ta») va qulf belgili eslatma. Oyna — `useConfirm()` (`children`).
 */
/**
 * Oyna xatosi (`ConfirmDialog` — `role="alert"`, mazmundan keyin) chiqqanda uni oyna tanasida ko'rinadigan
 * joyga suradi: telefonda (pastki varaq, 92dvh) uzun kuryer ro'yxati bilan xato pastda, ko'rinmas qolardi.
 * Umumiy `ConfirmDialog` ga tegmasdan (OS-3 fayllari) — mazmun konteynerini kuzatadi.
 */
const useRevealDialogError = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = ref.current?.parentElement;
    if (!container || typeof MutationObserver === "undefined") return;
    let shown: Node | null = null;
    let text = "";
    const observer = new MutationObserver(() => {
      const alert = container.querySelector<HTMLElement>(':scope > [role="alert"]');
      if (!alert || (alert === shown && alert.textContent === text)) {
        shown = alert;
        return;
      }
      shown = alert;
      text = alert.textContent ?? "";
      alert.scrollIntoView?.({ block: "nearest" });
    });
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);
  return ref;
};

export const ApproveReturnSummary = ({ rows }: { rows: ReturnRequestRow[] }) => {
  const { t, i18n } = useTranslation("ops");
  const summaryRef = useRevealDialogError();
  const number = (value: number) => formatNumberLocalized(value, { language: i18n.language });
  const groups = groupReturnRequestRowsByCourier(rows);
  const courierCount = groups.filter((group) => group.key).length;
  const withoutCourier = groups.find((group) => !group.key)?.rows.length ?? 0;

  return (
    <>
      <div ref={summaryRef} className="flex min-w-0 flex-col rounded-xl bg-sunken px-4 pt-4 pb-1">
        <div className="grid grid-cols-2 gap-3 pb-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-text-muted">{t("logistics.approve.orders")}</span>
            <span className="text-base font-bold text-text">
              {t("logistics.approve.ordersValue", { value: number(rows.length) })}
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-text-muted">{t("logistics.approve.couriers")}</span>
            <span className="text-base font-bold text-text">
              {t("logistics.approve.couriersValue", { value: number(courierCount) })}
            </span>
            {withoutCourier > 0 ? (
              <span className="text-xs text-text-muted">
                {t("logistics.approve.withoutCourier", { value: number(withoutCourier) })}
              </span>
            ) : null}
          </div>
        </div>

        {/* Uzun ro'yxat o'z ichida suriladi (maket: 340 px) — klaviatura bilan ham. Telefonda (pastki varaq, 92dvh)
            balandlik 30dvh gacha: aks holda xato bloki (`role="alert"`) pastki tugmalar ortida qolardi. */}
        <ul
          tabIndex={0}
          aria-label={t("logistics.approve.groups")}
          className="m-0 flex max-h-[340px] list-none max-md:max-h-[min(340px,30dvh)] flex-col overflow-y-auto p-0 pr-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
        >
          {groups.map((group) => {
            const hidden = group.rows.length - VISIBLE_ORDERS;
            return (
              <li key={group.key || "none"} className="flex min-w-0 flex-col gap-2 border-t border-border py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  {group.key ? (
                    <span
                      aria-hidden="true"
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-avatar text-[13px] font-bold text-on-avatar"
                    >
                      {initialsOf(group.courier)}
                    </span>
                  ) : (
                    <span
                      aria-hidden="true"
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-border-strong bg-sunken text-text-subtle"
                    >
                      <User size={16} />
                    </span>
                  )}
                  <span
                    className={
                      group.key
                        ? "min-w-0 flex-1 truncate text-sm font-semibold text-text"
                        : "min-w-0 flex-1 truncate text-sm font-semibold text-text-muted"
                    }
                  >
                    {group.courier || t("logistics.list.noCourier")}
                  </span>
                  <Badge className="shrink-0">{t("logistics.approve.groupCount", { value: number(group.rows.length) })}</Badge>
                </div>
                <ul className="m-0 flex list-none flex-col gap-1 p-0 pl-[42px]">
                  {group.rows.slice(0, VISIBLE_ORDERS).map((row) => (
                    <li key={row.key} className="flex min-w-0 items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-[13px] text-text">
                        {t("logistics.list.orderLink", { id: row.order_id || row.id })}
                      </span>
                      <span className="whitespace-nowrap text-xs text-text-muted">
                        {/* Noma'lum holat — «—» (xom backend qiymati ko'rsatilmaydi). */}
                        {t(`logistics.statuses.${row.status}`, { defaultValue: "—" })}
                      </span>
                    </li>
                  ))}
                  {hidden > 0 ? (
                    <li className="text-xs text-text-muted">{t("logistics.approve.more", { value: number(hidden) })}</li>
                  ) : null}
                </ul>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="m-0 flex items-start gap-2 text-[13px] text-text-muted">
        <Lock aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
        <span className="min-w-0">{t("logistics.approve.note")}</span>
      </p>
    </>
  );
};
