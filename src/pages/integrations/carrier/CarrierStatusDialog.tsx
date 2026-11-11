// dizayn-v2: superadmin-integrations-carrier-status-dialog, admin-integrations-carrier-status-dialog
import { useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleQuestionMark, CircleX, Power, User } from "lucide-react";
import {
  useCarrierAccountActions,
  type CarrierAccount,
} from "../../../entities/integrations/carriers";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { formatPhone } from "../../../shared/lib/formatPhone";
import { notify } from "../../../shared/lib/notify";
import { Button, ConfirmDialog, Dialog } from "../../../shared/ui/primitives";
import { InlineAlert } from "../ui";
import { classifyCarrierError, isCourierActive, type CourierInfo } from "./carrierModel";
import { useCourierName } from "./carrierFormat";
import { useRetained } from "./carrierHooks";
import {
  AccountSummary,
  CarrierStateBadge,
  CourierSummary,
  MarkedList,
  MutedNote,
} from "./carrierParts";
import { invalidateCarrierCourier } from "./useCarrierCouriers";

/**
 * TO'XTATISH / YOQISH (maket `*-carrier-status-dialog`; DESIGN_SYSTEM §8 — kirishni o'chirish faqat tasdiq bilan):
 *  - to'xtatish — nima darhol to'xtaydi, «Buyurtma biriktirish to'xtamaydi» ogohlantirishi, nima o'zgarmaydi;
 *  - yoqish — o'sha kalit qaytadi, bog'langan kuryer tekshiruvi (`GET users/:id` holati);
 *  - server yoqishni rad etsa (kuryer faol emas / topilmadi) — «Yoqilmadi» + «Kuryerni ochish».
 * Yopilish harakati davomida oxirgi akkaunt bilan chiziladi (muvaffaqiyatdan keyin «Yoqish» oynasi «To'xtatish» ga
 * aylanib so'nmasin).
 */
export const CarrierStatusDialog = ({
  account,
  couriers,
  onClose,
  returnFocus,
}: {
  account: CarrierAccount | null;
  /** Bog'langan kuryerlar (`useLinkedCouriers`) — yopilish paytida ham oxirgi akkauntning kuryeri. */
  couriers: ReadonlyMap<string, CourierInfo>;
  onClose: () => void;
  /** «Yoqilmadi» yopilgach fokus («Yoqish» tugmasi): u tasdiq yopilayotganda ochiladi. */
  returnFocus?: RefObject<HTMLElement | null>;
}) => {
  const { t } = useTranslation("integrations");
  const navigate = useNavigate();
  const client = useQueryClient();
  const { setActive } = useCarrierAccountActions();
  const courierName = useCourierName();
  const [refused, setRefused] = useState(false);
  const open = account !== null;
  const shown = useRetained(account);
  const info = shown ? couriers.get(shown.courier_user_id) : undefined;
  /**
   * Amal ochilgan paytdagi holatdan: oyna ochiq turganda (yoki muvaffaqiyatdan keyin so'nayotganda) ro'yxat
   * yangilanib `is_active` almashsa ham «To'xtatish» oynasi «Yoqish» ga aylanmaydi va so'rov foydalanuvchi
   * tasdiqlagan amalni yuboradi.
   */
  const [openedActive, setOpenedActive] = useState<boolean | null>(account?.is_active ?? null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (account) setOpenedActive(account.is_active);
  }
  const stopping = openedActive ?? true;

  const close = () => {
    setRefused(false);
    onClose();
  };

  const run = async () => {
    if (!account) return;
    const next = !stopping;
    try {
      await setActive.mutateAsync({ id: account.id, is_active: next });
      notify.success(
        t(next ? "carrier.status.startedOk" : "carrier.status.stoppedOk", { name: account.name }),
      );
      close();
    } catch (error) {
      if (next && classifyCarrierError(error) === "courier") {
        invalidateCarrierCourier(client, account.courier_user_id);
        setRefused(true);
        return;
      }
      notify.error(getBackendErrorMessage(error) || t("carrier.status.failed"));
      close();
    }
  };

  /**
   * Kuryer tekshiruvi — uch holat: faol (ma'lumot bor), faol emas / topilmadi, noma'lum (`users/:id` hali kelmagan yoki
   * yiqilgan). Noma'lumda «faol» deb yozilmaydi — yoqishda server o'zi tekshiradi.
   */
  const courierCheck: "ok" | "bad" | "unknown" =
    info?.state === "missing" || (info?.state === "ready" && !isCourierActive(info.courier))
      ? "bad"
      : info?.state === "ready"
        ? "ok"
        : "unknown";

  return (
    <>
      <ConfirmDialog
        open={open && !refused}
        tone={stopping ? "danger" : "primary"}
        icon={Power}
        iconTone={stopping ? "danger" : "success"}
        confirmIcon={Power}
        title={t(stopping ? "carrier.status.stopTitle" : "carrier.status.startTitle")}
        description={
          shown
            ? t(stopping ? "carrier.status.stopDesc" : "carrier.status.startDesc", {
                name: shown.name,
              })
            : undefined
        }
        confirmLabel={t(stopping ? "carrier.status.stopConfirm" : "carrier.status.startConfirm")}
        cancelLabel={t("carrier.cancel")}
        size="md"
        onCancel={close}
        onConfirm={run}
      >
        {/* Akkaunt kartasi `children` da: `details` uni yana bir `sunken` quti ichiga olardi (maket — bitta quti). */}
        {shown ? (
          <div className="flex flex-col gap-4">
            <AccountSummary
              account={shown}
              info={info}
              badge={<CarrierStateBadge state={stopping ? "active" : "stopped"} />}
            />
            {stopping ? (
              <>
                <MarkedList
                  title={t("carrier.status.stopsNow")}
                  tone="danger"
                  items={[t("carrier.status.stops1"), t("carrier.status.stops2")]}
                />
                <InlineAlert tone="warning" title={t("carrier.status.assignTitle")}>
                  {t("carrier.status.assignText")}
                </InlineAlert>
                <MarkedList
                  title={t("carrier.status.stays")}
                  tone="success"
                  items={[
                    t("carrier.status.stays1"),
                    t("carrier.status.stays2"),
                    t("carrier.status.stays3"),
                  ]}
                />
                <MutedNote>{t("carrier.status.leakNote")}</MutedNote>
              </>
            ) : (
              <>
                <p className="text-[13px] leading-[18px] text-text">{t("carrier.status.startLead")}</p>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[.04em] text-text-muted">
                    {t("carrier.status.check")}
                  </span>
                  <div className="flex items-start gap-2.5 rounded-[10px] border border-border px-3 py-2.5">
                    {courierCheck === "bad" ? (
                      <CircleX
                        size={18}
                        aria-hidden="true"
                        className="mt-px flex-none text-danger-fg"
                      />
                    ) : courierCheck === "ok" ? (
                      <CircleCheck
                        size={18}
                        aria-hidden="true"
                        className="mt-px flex-none text-success-fg"
                      />
                    ) : (
                      <CircleQuestionMark
                        size={18}
                        aria-hidden="true"
                        className="mt-px flex-none text-text-subtle"
                      />
                    )}
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-semibold text-text">
                        {t(
                          courierCheck === "bad"
                            ? "carrier.status.checkBad"
                            : courierCheck === "ok"
                              ? "carrier.status.checkOk"
                              : "carrier.status.checkUnknown",
                        )}
                      </span>
                      <span className="text-[13px] text-text-muted">
                        {[
                          courierName(shown, info),
                          info?.state === "ready" && info.courier.phone
                            ? formatPhone(info.courier.phone)
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </div>
                  <span className="text-xs text-text-muted">{t("carrier.status.checkHint")}</span>
                </div>
              </>
            )}
          </div>
        ) : null}
      </ConfirmDialog>

      <Dialog
        open={open && refused}
        onClose={close}
        role="alertdialog"
        closable={false}
        returnFocus={returnFocus ?? true}
        title={t("carrier.status.refusedTitle")}
        description={shown ? t("carrier.status.refusedDesc", { name: shown.name }) : undefined}
        icon={CircleX}
        iconTone="danger"
        iconShape="circle"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              {t("carrier.close")}
            </Button>
            <Button
              leftIcon={User}
              onClick={() => {
                if (!shown) return;
                close();
                navigate(`/all-users/${shown.courier_user_id}`);
              }}
            >
              {t("carrier.detail.openCourier")}
            </Button>
          </>
        }
      >
        {shown ? (
          <div className="flex flex-col gap-4">
            <InlineAlert tone="danger" title={t("carrier.status.refusedAlertTitle")}>
              {t("carrier.status.refusedAlertText")}
            </InlineAlert>
            <CourierSummary account={shown} info={info} />
            <MutedNote>{t("carrier.status.refusedNote")}</MutedNote>
          </div>
        ) : null}
      </Dialog>
    </>
  );
};
