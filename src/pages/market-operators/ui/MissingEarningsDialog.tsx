// dizayn-v2: (maket yo'q) market-operators-commission-dialog
import { memo } from "react";
import { Calculator } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatCommissionValue, type MarketOperator } from "../../../entities/market-operator";
import { useMissingEarnings, useRecordMissingEarnings } from "../../../entities/operator-payment";
import { formatMoneyLocalized, formatNumberLocalized, resolveMoneyLanguage } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import { Button, Dialog, Skeleton } from "../../../shared/ui/primitives";

type Props = {
  /** Ochiq oyna operatori; `null` — yopiq. */
  operator: MarketOperator | null;
  onClose: () => void;
};

/**
 * «O'TGAN SOTUVLARGA HISOBLASH» (2026-11-20; maket yo'q — eng yaqini Komissiya oynasi). Ega: «operator nomidan
 * yaratilgan buyurtmalarga xizmat haqqi yozilmayapti». Sotuv paytida operator stavkasi belgilanmagan bo'lsa ulush
 * yozilmagan va keyin stavka belgilansa ham o'tgan sotuvlar hisoblanmagan. Oyna oldindan ko'rsatadi (hech narsa
 * yozilmaydi): sotilgan buyurtmalar, ulushi yozilgani, yozilmagani va JORIY stavka bo'yicha summa; «Hisoblash» —
 * faqat ulushi umuman yozilmagan buyurtmalarga (takror bosish ikkinchi marta yozmaydi). Elchi kassasiga ta'sir yo'q.
 */
export const MissingEarningsDialog = memo(({ operator, onClose }: Props) => {
  const { t, i18n } = useTranslation("marketOperators");
  const language = resolveMoneyLanguage(i18n.resolvedLanguage ?? i18n.language);
  const preview = useMissingEarnings(operator?.id ?? null);
  const record = useRecordMissingEarnings();
  const data = preview.data;
  const money = (value: number) => formatMoneyLocalized(value, { language });
  const count = (value: number) => formatNumberLocalized(value, { language });
  const busy = record.isPending;
  const canRecord = Boolean(data && data.toRecord > 0) && !busy;
  const rate =
    data?.commissionType && data.commissionValue > 0
      ? formatCommissionValue(data.commissionType, data.commissionValue, language)
      : null;

  const submit = async () => {
    if (!operator || !canRecord) return;
    try {
      const result = await record.mutateAsync(operator.id);
      notify.success(t("missingEarnings.done", { value: count(result.created), name: operator.name }), {
        description: t("missingEarnings.doneText", { amount: money(result.createdAmount) }),
      });
      onClose();
    } catch {
      notify.error(t("missingEarnings.failed"), { description: t("missingEarnings.failedText") });
    }
  };

  const row = (label: string, value: string, strong = false) => (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className={strong ? "m-0 text-sm font-semibold text-text tabular-nums" : "m-0 text-sm text-text tabular-nums"}>
        {value}
      </dd>
    </div>
  );

  return (
    <Dialog
      open={operator !== null}
      onClose={onClose}
      busy={busy}
      size="md"
      icon={Calculator}
      title={t("missingEarnings.title", { name: operator?.name ?? "" })}
      description={t("missingEarnings.description")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("missingEarnings.cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={!canRecord} loading={busy}>
            {t("missingEarnings.record")}
          </Button>
        </>
      }
    >
      {preview.isLoading ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label={t("missingEarnings.loading")}>
          <Skeleton tone="border" width="70%" />
          <Skeleton tone="border" width="50%" />
          <Skeleton tone="border" width="60%" />
        </div>
      ) : preview.isError || !data ? (
        <p role="alert" className="m-0 text-sm text-danger-fg">
          {t("missingEarnings.loadFailed")}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <dl className="m-0 divide-y divide-border">
            {row(t("missingEarnings.soldOrders"), count(data.soldOrders))}
            {row(t("missingEarnings.alreadyRecorded"), count(data.alreadyRecorded))}
            {row(t("missingEarnings.missing"), count(data.missing), true)}
            {row(t("missingEarnings.rate"), rate ?? t("missingEarnings.noRate"))}
            {row(t("missingEarnings.amount"), money(data.amount), true)}
          </dl>
          <p className="m-0 text-[13px] text-text-muted">
            {data.toRecord > 0
              ? t("missingEarnings.willRecord", { value: count(data.toRecord), amount: money(data.amount) })
              : rate
                ? t("missingEarnings.nothing")
                : t("missingEarnings.setRateFirst")}
          </p>
          {data.truncated ? <p className="m-0 text-[13px] text-text-muted">{t("missingEarnings.truncated")}</p> : null}
        </div>
      )}
    </Dialog>
  );
});
MissingEarningsDialog.displayName = "MissingEarningsDialog";
