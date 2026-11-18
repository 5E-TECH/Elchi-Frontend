// dizayn-v2: (maket yo'q) superadmin-notifications-campaign-cancel-dialog
import { CircleX } from "lucide-react";
import { useCancelDeliveryTariff } from "../../../entities/delivery-pricing";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import { formatDateLocalized } from "../../../shared/lib/formatDateTime";
import { notify } from "../../../shared/lib/notify";
import { Badge, useConfirm } from "../../../shared/ui/primitives";
import type { HistoryEntry } from "../model/history";
import { useTariffText } from "./useTariffText";

/**
 * «REJALASHTIRILGAN TARIFNI BEKOR QILISH» (B0ILd7YI; maket yo'q — eng yaqini
 * `superadmin-notifications-campaign-cancel-dialog`: xavfli tasdiq, ob'ekt kartasi, «Yopish» · aniq fe'l).
 * `POST /delivery/tariffs/:id/cancel` — faqat hali kuchga kirmagan versiya; hozirgi tarif o'zgarmaydi.
 * Takror so'rov (vaqt tugagach qayta bosish) — backend 200 `already_cancelled`, ya'ni muvaffaqiyat. 409 — versiya
 * allaqachon kuchga kirgan: xato oyna ichida, «Tarifni bekor qilish» o'chadi, ro'yxat qayta so'raladi.
 */
export const useCancelScheduledTariff = () => {
  const { t, changes, name, saveError } = useTariffText();
  const confirm = useConfirm();
  const cancel = useCancelDeliveryTariff();

  return async (entry: HistoryEntry) => {
    const { version } = entry;
    const tariffName = name(version.tariffId);
    const date = formatDateLocalized(version.validFrom);
    const done = await confirm({
      title: t("page.cancelScheduled.title"),
      description: t("page.cancelScheduled.description"),
      confirmLabel: t("page.cancelScheduled.confirm"),
      cancelLabel: t("page.cancelScheduled.close"),
      loadingLabel: t("page.cancelScheduled.loading"),
      tone: "danger",
      icon: CircleX,
      confirmIcon: CircleX,
      details: (
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 font-semibold text-text">{tariffName}</span>
            <Badge tone="info" size="sm">
              {t("page.history.scheduled")}
            </Badge>
          </div>
          <span className="text-[13px] text-text">{changes(entry.changes)}</span>
          <span className="text-[13px] text-text-muted">{t("page.cancelScheduled.from", { date })}</span>
        </div>
      ),
      consequences: [{ text: t("page.cancelScheduled.keepCurrent") }, { text: t("page.cancelScheduled.history") }],
      errorView: (error) => {
        const status = getErrorStatus(error);
        if (status !== 409 && status !== 404) return null;
        return {
          content: (
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-semibold">{t("page.cancelScheduled.error")}</span>
              <span>{t(status === 409 ? "page.cancelScheduled.conflict" : "page.cancelScheduled.notFound")}</span>
            </span>
          ),
          blockConfirm: true,
        };
      },
      errorMessage: (error) => (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-semibold">{t("page.cancelScheduled.error")}</span>
          <span>{saveError(error)}</span>
        </span>
      ),
      onConfirm: async () => {
        await cancel.mutateAsync(version.id);
      },
    });
    if (done) {
      notify.success(t("page.cancelScheduled.success"), {
        description: t("page.cancelScheduled.successDescription", { name: tariffName, date }),
      });
    }
  };
};
