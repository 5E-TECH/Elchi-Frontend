// dizayn-v2: superadmin-integrations-carrier-rotate-dialog, admin-integrations-carrier-rotate-dialog
import { useRef, useState, type RefObject } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CircleX, Clock, KeyRound, RefreshCw, User } from "lucide-react";
import {
  useCarrierAccountActions,
  type CarrierAccount,
} from "../../../entities/integrations/carriers";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { notify } from "../../../shared/lib/notify";
import { Button, ConfirmDialog, Dialog } from "../../../shared/ui/primitives";
import { InlineAlert } from "../ui";
import { classifyCarrierError, type CourierInfo } from "./carrierModel";
import { useLeaveGuard, useRetained } from "./carrierHooks";
import { AccountSummary, CourierSummary, MarkedList, MutedNote } from "./carrierParts";
import type { CarrierKeyReveal } from "./CarrierKeyDialog";
import { invalidateCarrierCourier } from "./useCarrierCouriers";

/**
 * KALITNI YANGILASH (maket `*-carrier-rotate-dialog`): tasdiq → yangi kalit oynasi; server rad etsa (kuryer faol
 * emas / topilmadi) — «Kalit yangilanmadi» + «Kuryerni ochish»; natija noma'lum bo'lsa (javob kelmadi, 502/504/500,
 * javobda kalit yo'q) — «Javob kelmadi» + «Qayta yangilash» (xavfsiz: faqat oxirgi berilgan kalit ishlaydi).
 * So'rov ketayotganda sahifani yangilash / yopish brauzer tasdig'ini so'raydi, «Orqaga» bekor qilinadi: server eski
 * kalitni o'chirib bo'lgan bo'lishi mumkin, yangisi esa faqat shu javobda keladi.
 */
type Phase = "confirm" | "refused" | "unknown";

export const CarrierRotateDialog = ({
  account,
  couriers,
  onClose,
  onRotated,
  returnFocus,
}: {
  account: CarrierAccount | null;
  /** Bog'langan kuryerlar (`useLinkedCouriers`) — yopilish paytida ham oxirgi akkauntning kuryeri. */
  couriers: ReadonlyMap<string, CourierInfo>;
  onClose: () => void;
  onRotated: (reveal: CarrierKeyReveal) => void;
  /** Rad / «Javob kelmadi» oynasi yopilgach fokus («Kalitni yangilash» tugmasi): ular tasdiq yopilayotganda ochiladi. */
  returnFocus?: RefObject<HTMLElement | null>;
}) => {
  const { t } = useTranslation("integrations");
  const navigate = useNavigate();
  const client = useQueryClient();
  const { rotateKey } = useCarrierAccountActions();
  const [phase, setPhase] = useState<Phase>("confirm");
  /** Ikki marta bosilsa ikki kalit chiqmasin (birinchisi darhol o'lardi). */
  const inFlightRef = useRef(false);
  const open = account !== null;
  // Yopilish harakati davomida oxirgi akkaunt bilan chiziladi.
  const shown = useRetained(account);
  const info = shown ? couriers.get(shown.courier_user_id) : undefined;
  useLeaveGuard(rotateKey.isPending);

  const close = () => {
    setPhase("confirm");
    onClose();
  };

  const run = async () => {
    if (!account || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const result = await rotateKey.mutateAsync(account.id);
      const apiKey = result.api_key;
      // Kalit mutatsiya holatida qolmasin (`gcTime: 0` — kuzatuvchisiz darhol yig'iladi).
      rotateKey.reset();
      setPhase("confirm");
      onRotated({ variant: "rotated", accountName: account.name, apiKey });
    } catch (error) {
      const kind = classifyCarrierError(error, { serverErrorUnknown: true });
      if (kind === "courier") {
        invalidateCarrierCourier(client, account.courier_user_id);
        setPhase("refused");
      } else if (kind === "unknown") setPhase("unknown");
      else {
        notify.error(getBackendErrorMessage(error) || t("carrier.rotate.failed"));
        close();
      }
    } finally {
      inFlightRef.current = false;
    }
  };

  const openCourier = () => {
    if (!shown) return;
    close();
    navigate(`/all-users/${shown.courier_user_id}`);
  };

  return (
    <>
      <ConfirmDialog
        open={open && phase === "confirm"}
        tone="danger"
        icon={KeyRound}
        confirmIcon={RefreshCw}
        title={t("carrier.rotate.title")}
        description={
          <>
            <span className="font-semibold text-text">{t("carrier.rotate.descStrong")}</span>{" "}
            {t("carrier.rotate.desc")}
          </>
        }
        confirmLabel={t("carrier.rotate.confirm")}
        cancelLabel={t("carrier.cancel")}
        size="md"
        onCancel={close}
        onConfirm={run}
      >
        {/* Akkaunt kartasi `children` da: `details` uni yana bir `sunken` quti ichiga olardi (maket — bitta quti). */}
        {shown ? (
          <div className="flex flex-col gap-4">
            <AccountSummary account={shown} info={info} />
            <MarkedList
              title={t("carrier.rotate.unchanged")}
              tone="success"
              items={[t("carrier.rotate.unchanged1"), t("carrier.rotate.unchanged2")]}
            />
            <MutedNote>
              <Trans
                t={t}
                i18nKey="carrier.rotate.note"
                components={{ strong: <span className="font-semibold text-text" /> }}
              />
            </MutedNote>
          </div>
        ) : null}
      </ConfirmDialog>

      <Dialog
        open={open && phase === "refused"}
        onClose={close}
        role="alertdialog"
        closable={false}
        returnFocus={returnFocus ?? true}
        title={t("carrier.rotate.refusedTitle")}
        description={shown ? t("carrier.rotate.refusedDesc", { name: shown.name }) : undefined}
        icon={CircleX}
        iconTone="danger"
        iconShape="circle"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              {t("carrier.close")}
            </Button>
            <Button leftIcon={User} onClick={openCourier}>
              {t("carrier.detail.openCourier")}
            </Button>
          </>
        }
      >
        {shown ? (
          <div className="flex flex-col gap-4">
            <InlineAlert tone="danger" title={t("carrier.rotate.refusedAlertTitle")}>
              {t("carrier.rotate.refusedAlertText")}
            </InlineAlert>
            <CourierSummary account={shown} info={info} />
            <MutedNote>{t("carrier.rotate.refusedNote")}</MutedNote>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={open && phase === "unknown"}
        onClose={close}
        role="alertdialog"
        closable={false}
        busy={rotateKey.isPending}
        returnFocus={returnFocus ?? true}
        title={t("carrier.rotate.unknownTitle")}
        description={shown ? t("carrier.rotate.unknownDesc", { name: shown.name }) : undefined}
        icon={Clock}
        iconTone="warning"
        iconShape="circle"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={rotateKey.isPending}>
              {t("carrier.close")}
            </Button>
            <Button
              variant="danger"
              leftIcon={RefreshCw}
              loading={rotateKey.isPending}
              onClick={() => void run()}
            >
              {t("carrier.rotate.retry")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <InlineAlert tone="warning" role="alert" title={t("carrier.rotate.unknownAlertTitle")}>
            {t("carrier.rotate.unknownAlertText")}
          </InlineAlert>
          <MutedNote>{t("carrier.rotate.unknownNote")}</MutedNote>
        </div>
      </Dialog>
    </>
  );
};
