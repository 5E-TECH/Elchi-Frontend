// dizayn-v2: superadmin-neworders-create-ai-preview, superadmin-neworders-create-ai-confirm-dialog, admin-neworders-create-ai, admin-neworders-create-ai-confirm-dialog, manager-new-orders-create-ai, manager-new-orders-create-ai-confirm-dialog, registrator-new-orders-create-ai, registrator-new-orders-create-ai-confirm-dialog, market-new-orders-create-ai-preview, market-new-orders-create-ai-confirm-dialog
import { memo, useState, type Ref } from "react";
import { Send, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatMoneyLocalized } from "../../../../../shared/lib/formatMoney";
import { Button, Card, Dialog } from "../../../../../shared/ui/primitives";
import type { AiDraftOrder } from "./evalPreview";

/**
 * Shu sondan KO'P buyurtma birdaniga yaratilsa tasdiq oynasi chiqadi —
 * operator AI natijasini ko'r-ko'rona tasdiqlab yubormasligi uchun oxirgi to'siq.
 */
const CONFIRM_DIALOG_THRESHOLD = 5;

type AiConfirmBarProps = {
  readyOrders: AiDraftOrder[];
  notReadyCount: number;
  pending: boolean;
  onConfirm: () => void;
  /** Keyingi to'ldirilmagan kartaga o'tish (10-30 karta orasida yo'qolmaslik uchun). */
  onJumpToUnready: () => void;
  /** Panel elementi — klaviatura ochilganda maydon shu panel ustida turishi uchun. */
  barRef?: Ref<HTMLElement>;
};

/**
 * «YARATISHNI TASDIQLASH» PANELI (maket `*-create-ai-preview`): pastga yopishgan karta — «N ta tayyor ·
 * M ta to'ldirilmagan», «To'ldirilmagan (M)» (keyingi to'ldirilmagan kartaga) va asosiy «Tayyorlarini
 * yaratish — N ta». Panel `<main>` ichida: u pastki menyu USTIDA tugaydi (shell), shuning uchun faqat
 * kichik oraliq bilan `bottom-*`; telefonda tugmalar joy yetmasa ikki qatorga o'tib, to'liq enli bo'ladi.
 * Ko'p buyurtmada (> 5) tasdiq oynasi (maket `*-create-ai-confirm-dialog`): ism, summa, tuman.
 *
 * ⚠️ "Hammasini yaratish" tugmasi ATAYLAB YO'Q: faqat `ready` kartalar
 * yaratiladi, to'ldirilmaganlari so'rovga umuman qo'shilmaydi.
 */
const AiConfirmBar = ({ readyOrders, notReadyCount, pending, onConfirm, onJumpToUnready, barRef }: AiConfirmBarProps) => {
  const { t, i18n } = useTranslation(["orders", "common"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [dialogOpen, setDialogOpen] = useState(false);
  const readyCount = readyOrders.length;
  const disabled = readyCount === 0;

  const handleClick = () => {
    if (disabled || pending) return;
    if (readyCount > CONFIRM_DIALOG_THRESHOLD) {
      setDialogOpen(true);
      return;
    }
    onConfirm();
  };

  return (
    <>
      <Card
        as="div"
        padding="none"
        ref={barRef}
        role="region"
        aria-label={t("aiConfirmRegionLabel")}
        data-testid="ai-confirm-bar"
        className="sticky bottom-4 z-10 shadow-xl max-md:bottom-2"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <p role="status" className="min-w-0 text-sm font-semibold">
            <span className="text-success-fg">{t("aiReadyCount", { count: readyCount })}</span>
            {notReadyCount > 0 ? (
              <>
                <span className="text-text-muted"> · </span>
                <span className="text-warning-fg">{t("aiNotReadyCount", { count: notReadyCount })}</span>
              </>
            ) : null}
          </p>
          <div className="flex flex-[0_1_auto] flex-wrap gap-2 max-md:flex-auto">
            {notReadyCount > 0 ? (
              <Button
                variant="secondary"
                leftIcon={TriangleAlert}
                onClick={onJumpToUnready}
                title={t("aiJumpToUnreadyHint")}
                className="flex-[1_0_auto]"
              >
                {t("aiJumpToUnready", { count: notReadyCount })}
              </Button>
            ) : null}
            <Button
              leftIcon={Send}
              onClick={handleClick}
              disabled={disabled}
              loading={pending}
              loadingText={t("aiCreating")}
              className="flex-[1_0_auto]"
            >
              {t("aiCreateReady", { count: readyCount })}
            </Button>
          </div>
        </div>
      </Card>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        size="lg"
        icon={TriangleAlert}
        iconTone="warning"
        title={t("aiConfirmDialogTitle", { count: readyCount })}
        description={t("aiConfirmDialogDescription")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              {t("cancel", { ns: "common" })}
            </Button>
            <Button
              leftIcon={Send}
              onClick={() => {
                setDialogOpen(false);
                onConfirm();
              }}
            >
              {t("aiConfirmDialogSubmit")}
            </Button>
          </>
        }
      >
        <ul
          aria-label={t("aiConfirmListLabel")}
          data-testid="ai-confirm-list"
          className="flex max-h-[420px] flex-col overflow-auto rounded-xl bg-sunken p-1 text-sm"
        >
          {readyOrders.map((order, index) => (
            <li
              key={`${order.phone_number}-${index}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-t border-border px-3 py-2.5 first:border-t-0"
            >
              <span className="min-w-0 truncate font-semibold text-text">{order.customer_name}</span>
              <span className="whitespace-nowrap text-right font-semibold text-text tabular-nums">
                {formatMoneyLocalized(order.total_price ?? 0, { language })}
              </span>
              <span className="col-span-full text-[13px] text-text-muted">{order.district_name ?? "—"}</span>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
};

export default memo(AiConfirmBar);
