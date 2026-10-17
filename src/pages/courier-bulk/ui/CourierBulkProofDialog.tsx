// dizayn-v2: (maket yo'q) tizim-states-forms, courier-courier-bulk-confirm-dialog
import { useState } from "react";
import { Camera, Check, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatMoneyLocalized } from "../../../shared/lib/formatMoney";
import { Badge, Button, ButtonIcon, Dialog } from "../../../shared/ui/primitives";
import { ProofField } from "../../orders/list/courier/list/OrderActionParts";
import { isProofFileTooLarge, MAX_PROOF_SIZE_MB } from "../../orders/list/courier/list/orderActionModel";
import {
  getCourierBulkProofKey,
  hasAllCourierBulkProofs,
  type CourierBulkFinalizeTask,
  type CourierBulkOrder,
} from "../model/courierBulk";

/**
 * «Kunni yakunlash» — ISBOT QADAMI (j9KFyqlS). Market sotish/bekor qilishda rasm yoki video
 * isbot talab qilsa (`market.expense_proof_conditions`), backend isbotsiz amalni 400 bilan rad
 * etadi. Tasdiqdan keyin shu oyna faqat isbot kerak bo'lgan buyurtmalarni sanaydi: har biriga
 * bitta maydon (`ProofField` — `/orders` sotish/bekor qilish oynalaridagi o'sha maydon; telefonda
 * bosilsa kamera yoki galereya). Hamma isbot tanlanmaguncha «Yakunlash» o'chiq
 * (`tizim-states-forms` 06 «majburiy bo'lsa, fayl yuklanmaguncha asosiy tugma o'chiq turadi»).
 *
 * Maket yo'q (kartadagi dizayn ziddiyati) — eng yaqini: `tizim-states-forms` («Isbot yuklash
 * maydoni») + `courier-courier-bulk-confirm-dialog` (sarlavha, `sunken` ro'yxat, amallar).
 */

type Props = {
  open: boolean;
  /** Isbot talab qilinadigan vazifalar (tartib — ro'yxatdagidek). */
  tasks: ReadonlyArray<CourierBulkFinalizeTask<CourierBulkOrder>>;
  /** Isbotsiz yakunlanadigan qolgan buyurtmalar soni. */
  plainCount: number;
  /** Tanlangan isbotlar, kalit — `getCourierBulkProofKey` (buyurtma + amal). */
  proofs: Readonly<Record<string, File | undefined>>;
  onProofChange: (proofKey: string, file: File | undefined) => void;
  /** So'rovlar ketmoqda — oyna yopilmaydi, «Yakunlash» yuklanish holatida. */
  busy: boolean;
  onClose: () => void;
  onSubmit: () => void;
  /** Yopilish harakati tugagach (vazifalar shundan keyin tozalanadi). */
  onExited?: () => void;
};

const getCustomerName = (order: CourierBulkOrder) => order.customer?.name?.trim() || `#${order.id}`;

const getPlace = (order: CourierBulkOrder) =>
  [order.district?.name ?? order.region?.name, order.market?.name].filter(Boolean).join(" · ");

export const CourierBulkProofDialog = ({
  open,
  tasks,
  plainCount,
  proofs,
  onProofChange,
  busy,
  onClose,
  onSubmit,
  onExited,
}: Props) => {
  const { t, i18n } = useTranslation(["courierBulk", "orders"]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Har ochilishda eski xato matnlari tozalanadi (tanlangan fayllar esa sahifada saqlanadi).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setErrors({});
  }
  const total = tasks.length;
  const done = tasks.filter((task) => proofs[getCourierBulkProofKey(task)] instanceof File).length;
  const ready = total > 0 && hasAllCourierBulkProofs(tasks, proofs);

  const handleFileChange = (proofKey: string, file: File | undefined) => {
    if (file && isProofFileTooLarge(file)) {
      setErrors((previous) => ({
        ...previous,
        [proofKey]: t("orders:mediaProofTooLarge", { size: MAX_PROOF_SIZE_MB }),
      }));
      onProofChange(proofKey, undefined);
      return;
    }
    setErrors((previous) => {
      if (!(proofKey in previous)) return previous;
      const next = { ...previous };
      delete next[proofKey];
      return next;
    });
    onProofChange(proofKey, file);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onExited={onExited}
      busy={busy}
      size="lg"
      icon={Camera}
      title={t("proofTitle")}
      description={t("proofDescription", { count: total })}
      initialFocus="panel"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("confirmBack")}
          </Button>
          <Button
            variant="primary"
            leftIcon={Check}
            disabled={!ready}
            loading={busy}
            onClick={onSubmit}
          >
            {t("proofSubmit")}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px] text-text-muted">
        <span role="status" className="font-semibold text-text">
          {t("proofProgress", { done, total })}
        </span>
        {!ready ? <span>{t("proofProgressHint")}</span> : null}
      </div>

      <ul aria-label={t("proofListLabel")} className="m-0 flex list-none flex-col gap-4 p-0">
        {tasks.map(({ order, action }) => {
          const proofKey = getCourierBulkProofKey({ order, action });
          const name = getCustomerName(order);
          const place = getPlace(order);
          return (
            <li
              key={proofKey}
              role="group"
              aria-label={t("orderLabel", { id: order.id, name })}
              className="flex min-w-0 flex-col gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold text-text">
                    {t("orderLabel", { id: order.id, name })}
                  </span>
                  {place ? <span className="text-[13px] text-text-muted">{place}</span> : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="whitespace-nowrap text-sm font-semibold text-text">
                    {formatMoneyLocalized(Number(order.total_price) || 0, { language: i18n.language })}
                  </span>
                  <Badge size="sm" tone={action === "cancel" ? "danger" : "success"}>
                    {t(action === "cancel" ? "actionCancel" : "actionSell")}
                  </Badge>
                </div>
              </div>
              <ProofField
                variant="courier"
                file={proofs[proofKey] ?? null}
                required
                hint={t(action === "cancel" ? "proofHintCancel" : "proofHintSell")}
                error={errors[proofKey]}
                onFileChange={(file) => handleFileChange(proofKey, file)}
              />
            </li>
          );
        })}
      </ul>

      {plainCount > 0 ? (
        <p className="m-0 flex items-start gap-2 text-[13px] text-text-muted">
          <ButtonIcon icon={Info} px={16} className="mt-0.5" />
          <span className="min-w-0">{t("proofPlainNote", { count: plainCount })}</span>
        </p>
      ) : null}
    </Dialog>
  );
};
