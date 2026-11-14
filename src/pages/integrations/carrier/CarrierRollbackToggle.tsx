// dizayn-v2: (maket yo'q) superadmin-integrations-carrier-console, superadmin-integrations-panel-control, superadmin-integrations-carrier-status-dialog
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw, TriangleAlert } from "lucide-react";
import {
  useCarrierAccountActions,
  type CarrierAccount,
} from "../../../entities/integrations/carriers";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { notify } from "../../../shared/lib/notify";
import { ConfirmDialog, Pressable, StatusBadge } from "../../../shared/ui/primitives";
import { InlineAlert } from "../ui";
import type { CourierInfo } from "./carrierModel";
import { useRetained } from "./carrierHooks";
import { AccountSummary, MarkedList, MutedNote } from "./carrierParts";

/**
 * ROLLBACK RUXSATI — akkaunt tafsilotidagi «Ulanish holati» bo'limida BITTA kalit (ega so'rovi 2026-11-14).
 * Kompaniya yuborgan natijani (`sold` / `cancelled` → `waiting`) qaytarishga ruxsat; sukut — o'chiq (kompaniya bilan
 * ishonchli ish boshlanguncha). Faqat ichki: kompaniyaga hech qayerda ko'rsatilmaydi (Swagger, hujjat, «Kompaniya
 * dasturchisi uchun» bloki, kalit oynasidagi qadamlar) — admin izohi shu yerda.
 *
 * Maket yo'q — eng yaqini: shu konsolning «Ulanish holati» bloki (`*-carrier-console`) + `*-panel-control` kalit
 * qatori (`.el-switch`, o'ngda «Yoqiq / O'chiq»); tasdiq — `*-carrier-status-dialog` naqshi (pulga ta'sir qiladi:
 * ikkala yo'nalish ham tasdiq bilan, optimistik yangilanish yo'q).
 *
 *  - Backend maydonni bermasa (`rollback_enabled: null`, eski versiya) — «o'chiq», kalit o'chirilgan va
 *    «Backend yangilanishi kerak» izohi (eski backend `PATCH { rollback_enabled }` ni rad etardi).
 *  - So'rov ketayotganda kalit `aria-busy` va o'chirilgan; tasdiq tugmasida yuklanish (oyna yopilmaydi).
 *  - Muvaffaqiyat — javobdagi akkaunt keshga yoziladi (ro'yxat qayta so'ralmaydi, `setRollback`); javob qiymatni
 *    tasdiqlamasa — ogohlantirish va ro'yxat serverdan qayta o'qiladi; xato — backend matni bilan xabar.
 */
export const CarrierRollbackToggle = ({
  account,
  info,
}: {
  account: CarrierAccount;
  info: CourierInfo | undefined;
}) => {
  const { t } = useTranslation("integrations");
  const { setRollback } = useCarrierAccountActions();
  const titleId = useId();
  const hintId = useId();
  const unsupportedId = useId();
  /**
   * Tasdiq oynasi — so'ralgan YANGI qiymat, bosilgan paytdagi holatdan: oyna ochiq turganda ro'yxat yangilansa ham
   * (boshqa admin o'zgartirdi) «Yoqish» oynasi «O'chirish» ga aylanmaydi va so'rov tasdiqlangan qiymatni yuboradi.
   * Yopilish harakati davomida oxirgi qiymat bilan chiziladi (`useRetained`).
   */
  const [target, setTarget] = useState<boolean | null>(null);
  const shownTarget = useRetained(target);
  const enabling = shownTarget ?? true;
  const supported = account.rollback_enabled !== null;
  const checked = account.rollback_enabled === true;
  const pending = setRollback.isPending;

  const close = () => setTarget(null);

  const run = async () => {
    if (target === null) return;
    const next = target;
    try {
      const saved = await setRollback.mutateAsync({ id: account.id, rollback_enabled: next });
      if (saved?.rollback_enabled === next) {
        notify.success(
          t(next ? "carrier.rollback.enabledOk" : "carrier.rollback.disabledOk", {
            name: saved.name || account.name,
          }),
        );
      } else {
        notify.warning(t("carrier.rollback.unconfirmedTitle"), {
          description: t("carrier.rollback.unconfirmedText"),
        });
      }
      close();
    } catch (error) {
      notify.error(getBackendErrorMessage(error) || t("carrier.rollback.failed"));
      close();
    }
  };

  const stateLabel = (on: boolean) => t(on ? "carrier.rollback.on" : "carrier.rollback.off");

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border pt-4">
      <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
        <h4 id={titleId} className="inline-flex items-center gap-2 text-sm font-semibold text-text">
          <RotateCcw size={16} aria-hidden="true" className="flex-none text-text-muted" />
          {t("carrier.rollback.title")}
        </h4>
        <p id={hintId} className="text-[13px] leading-[18px] text-text-muted">
          {t("carrier.rollback.hint")}
        </p>
        {supported ? null : (
          <p
            id={unsupportedId}
            className="flex items-start gap-2 text-[13px] font-semibold leading-[18px] text-warning-fg"
          >
            <TriangleAlert size={16} aria-hidden="true" className="mt-px flex-none" />
            <span>{t("carrier.rollback.unsupported")}</span>
          </p>
        )}
      </div>
      <Pressable
        role="switch"
        aria-checked={checked}
        aria-labelledby={titleId}
        aria-describedby={supported ? hintId : `${hintId} ${unsupportedId}`}
        aria-busy={pending || undefined}
        disabled={!supported || pending}
        onClick={() => setTarget(!checked)}
        className="group flex min-h-11 items-center justify-between gap-2.5 rounded-[10px] disabled:cursor-not-allowed max-md:w-full"
      >
        <span className="text-[13px] font-semibold text-text group-disabled:text-text-muted">
          {stateLabel(checked)}
        </span>
        <span
          aria-hidden="true"
          className="relative h-5 w-9 flex-none rounded-full bg-border-strong transition-colors duration-150 group-aria-checked:bg-action group-disabled:opacity-45 motion-reduce:transition-none"
        >
          <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-on-solid transition-transform duration-150 group-aria-checked:translate-x-4 motion-reduce:transition-none" />
        </span>
      </Pressable>

      <ConfirmDialog
        open={target !== null}
        tone="primary"
        icon={RotateCcw}
        iconTone={enabling ? "warning" : "neutral"}
        confirmIcon={RotateCcw}
        title={t(enabling ? "carrier.rollback.enableTitle" : "carrier.rollback.disableTitle")}
        description={t(enabling ? "carrier.rollback.enableDesc" : "carrier.rollback.disableDesc", {
          name: account.name,
        })}
        confirmLabel={t(
          enabling ? "carrier.rollback.enableConfirm" : "carrier.rollback.disableConfirm",
        )}
        cancelLabel={t("carrier.cancel")}
        size="md"
        onCancel={close}
        onConfirm={run}
      >
        {/* Akkaunt kartasi `children` da (`details` uni yana bir `sunken` qutiga olardi) — holat oldingi qiymat. */}
        <div className="flex flex-col gap-4">
          <AccountSummary
            account={account}
            info={info}
            badge={
              <StatusBadge tone={enabling ? "neutral" : "success"} label={stateLabel(!enabling)} />
            }
          />
          {enabling ? (
            <>
              <InlineAlert tone="warning" title={t("carrier.rollback.enableAlertTitle")}>
                {t("carrier.rollback.enableAlertText")}
              </InlineAlert>
              <MutedNote>{t("carrier.rollback.enableNote")}</MutedNote>
            </>
          ) : (
            <>
              <MarkedList
                title={t("carrier.rollback.offNow")}
                tone="danger"
                items={[t("carrier.rollback.off1"), t("carrier.rollback.off2")]}
              />
              <MarkedList
                title={t("carrier.rollback.stays")}
                tone="success"
                items={[t("carrier.rollback.stays1"), t("carrier.rollback.stays2")]}
              />
            </>
          )}
        </div>
      </ConfirmDialog>
    </div>
  );
};
