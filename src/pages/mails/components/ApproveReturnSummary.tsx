// dizayn-v2: superadmin-ops-logistics-approve-dialog
import { useEffect, useRef } from "react";
import { Building2, Lock, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MailItem } from "../../../entities/mails";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Badge } from "../../../shared/ui/primitives";
import {
  getRequestId,
  getReturnOrderId,
  isCourierlessGroup,
  orderSummaryGroups,
  type ReturnGroup,
} from "../model/returnRequests";

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
 * Oyna xatosi (`ConfirmDialog` — `role="alert"`, mazmundan keyin) chiqqanda uni oyna tanasida ko'rinadigan
 * joyga suradi: telefonda (pastki varaq, 92dvh) uzun kuryer ro'yxati bilan xato pastda, ko'rinmas qolardi.
 * Umumiy `ConfirmDialog` ga tegmasdan — mazmun konteynerini kuzatadi.
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

/**
 * Qaytarish so'rovlarini tasdiqlash / rad etish oynasining mazmuni (maket `superadmin-ops-logistics-approve-dialog`;
 * u5HTJtqK da Ops'dan «Pochta → Qaytarish» ga ko'chdi): «Buyurtmalar N ta», «Kuryerlar M ta (+ K ta buyurtma
 * kuryersiz)», kuryer guruhlari (avatar, ism, son, birinchi 3 buyurtma va holati, «+ yana N ta») va qulf belgili
 * eslatma. Filial o'tkazmasi guruhlari kuryer emas — «kuryersiz» ga qo'shiladi, ro'yxatda filial nomi bilan.
 * Oyna — `useConfirm()` (`children`). `groups` — tanlangan so'rovlar guruhlari (`groupReturnRequests`).
 */
export const ApproveReturnSummary = ({
  groups: selectedGroups,
  stateLabel,
}: {
  groups: ReturnGroup[];
  /** So'rov holati yorlig'i — jadvaldagi badge matni bilan bir xil (noma'lum holat — «—»). */
  stateLabel: (item: MailItem) => string;
}) => {
  const { t, i18n } = useTranslation("mailsArchive");
  const summaryRef = useRevealDialogError();
  const number = (value: number) => formatNumberLocalized(value, { language: i18n.resolvedLanguage ?? i18n.language });
  const groups = orderSummaryGroups(selectedGroups);
  const orderCount = groups.reduce((sum, group) => sum + group.orders.length, 0);
  const courierCount = groups.filter((group) => group.kind === "courier" && !isCourierlessGroup(group)).length;
  const withoutCourier = groups
    .filter((group) => group.kind === "branch" || isCourierlessGroup(group))
    .reduce((sum, group) => sum + group.orders.length, 0);

  return (
    <>
      <div ref={summaryRef} className="flex min-w-0 flex-col rounded-xl bg-sunken px-4 pt-4 pb-1">
        <div className="grid grid-cols-2 gap-3 pb-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-text-muted">{t("return.dialog.orders")}</span>
            <span className="text-base font-bold text-text">
              {t("return.dialog.ordersValue", { value: number(orderCount) })}
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-text-muted">{t("return.dialog.couriers")}</span>
            <span className="text-base font-bold text-text">
              {t("return.dialog.couriersValue", { value: number(courierCount) })}
            </span>
            {withoutCourier > 0 ? (
              <span className="text-xs text-text-muted">
                {t("return.dialog.withoutCourier", { value: number(withoutCourier) })}
              </span>
            ) : null}
          </div>
        </div>

        {/* Uzun ro'yxat o'z ichida suriladi (maket: 340 px) — klaviatura bilan ham. Telefonda (pastki varaq, 92dvh)
            balandlik 30dvh gacha: aks holda xato bloki (`role="alert"`) pastki tugmalar ortida qolardi. */}
        <ul
          tabIndex={0}
          aria-label={t("return.dialog.groups")}
          className="m-0 flex max-h-[340px] list-none max-md:max-h-[min(340px,30dvh)] flex-col overflow-y-auto p-0 pr-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
        >
          {groups.map((group) => {
            const courierless = isCourierlessGroup(group);
            const hidden = group.orders.length - VISIBLE_ORDERS;
            return (
              <li key={group.key} className="flex min-w-0 flex-col gap-2 border-t border-border py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  {group.kind === "branch" ? (
                    <span
                      aria-hidden="true"
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-text-muted"
                    >
                      <Building2 size={16} />
                    </span>
                  ) : courierless ? (
                    <span
                      aria-hidden="true"
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-border-strong bg-sunken text-text-subtle"
                    >
                      <User size={16} />
                    </span>
                  ) : (
                    <span
                      aria-hidden="true"
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-avatar text-[13px] font-bold text-on-avatar"
                    >
                      {initialsOf(group.name)}
                    </span>
                  )}
                  <span
                    className={
                      courierless
                        ? "min-w-0 flex-1 truncate text-sm font-semibold text-text-muted"
                        : "min-w-0 flex-1 truncate text-sm font-semibold text-text"
                    }
                  >
                    {courierless ? t("return.dialog.noCourier") : group.name}
                  </span>
                  <Badge className="shrink-0">
                    {t("return.dialog.groupCount", { value: number(group.orders.length) })}
                  </Badge>
                </div>
                <ul className="m-0 flex list-none flex-col gap-1 p-0 pl-[42px]">
                  {group.orders.slice(0, VISIBLE_ORDERS).map((item) => (
                    <li key={getRequestId(item)} className="flex min-w-0 items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-[13px] text-text">
                        {t("return.dialog.orderNumber", { id: getReturnOrderId(item) })}
                      </span>
                      <span className="whitespace-nowrap text-xs text-text-muted">{stateLabel(item)}</span>
                    </li>
                  ))}
                  {hidden > 0 ? (
                    <li className="text-xs text-text-muted">{t("return.dialog.more", { value: number(hidden) })}</li>
                  ) : null}
                </ul>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="m-0 flex items-start gap-2 text-[13px] text-text-muted">
        <Lock aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
        <span className="min-w-0">{t("return.dialog.note")}</span>
      </p>
    </>
  );
};
