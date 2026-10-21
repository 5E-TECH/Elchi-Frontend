// dizayn-v2: manager-payments-main-cashbox-shift-open-dialog, superadmin-payments-main-cashbox-shift-open-dialog, admin-payments-main-cashbox-shift-open-dialog
import { memo, useCallback, useEffect } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import type { RootState } from "../../../app/config/store";
import { useCashBox } from "../../../entities/payments";
import { notify } from "../../../shared/lib/notify";
import OpenShiftDialog from "./OpenShiftDialog";

/**
 * «SMENANI OCHISH» OQIMI — asosiy kassa sahifasidan tashqaridagi kassa ekranlari uchun (CB-2: menejer
 * «To'lovlar», kassa tafsiloti). Ayni `OpenShiftDialog` (maket `*-payments-main-cashbox-shift-open-dialog`):
 *
 *  - kassa — joriy foydalanuvchi doirasi (menejer — o'z filiali kassasi, superadmin/admin — asosiy kassa; backend
 *    JWT'dan oladi), «Ochilish qoldig'i» — `GET finance/cashbox/main` (faqat oyna ochiq bo'lganda so'raladi);
 *  - `POST finance/shift/open` `{ comment? }` → muvaffaqiyatda `onOpened` (ota oynani yopadi, fokusni tiklangan
 *    formaga beradi) va «Smena ochildi»; smena holati (`shift/current`) mutatsiyaning o'zida qayta o'qiladi — qulf
 *    o'zi yo'qoladi;
 *  - xatoda oyna ochiq qoladi, faqat i18n xabar (xom backend matni yo'q) va holat qayta o'qiladi (smenani boshqa
 *    xodim ochgan bo'lishi mumkin);
 *  - oyna ochiq turganda smena ochiq bo'lib qolsa (`shiftOpen` — masalan 400 «allaqachon ochiq» dan keyingi qayta
 *    o'qish) — `onOpened`: oyna yopiladi, ikkinchi bosish yana 400 bermaydi.
 */

type OpenShiftFlowProps = {
  open: boolean;
  /** Bekor qilish (smena ochilmadi). */
  onClose: () => void;
  /** Smena ochildi (shu oynadan yoki boshqa xodim tomonidan) — ota oynani yopadi. */
  onOpened: () => void;
  /** Joriy smena holati ochiqmi (`useCashboxShift().status === "open"`). */
  shiftOpen: boolean;
  /** Ochadigan xodim (joriy foydalanuvchi) — `useCashboxShift().currentUserName`. */
  openerName: string;
  /** Xatoda smena holatini qayta o'qish — `useCashboxShift().refetch`. */
  onRefetchShift: () => void;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const getText = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : "");

const toFinite = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** `GET finance/cashbox/main` javobidan naqd/karta qoldig'i (asosiy kassa sahifasi bilan bir xil manba). */
const readCashboxSplit = (payload: unknown): { cash: number | null; card: number | null } => {
  const data = asRecord(asRecord(payload).data);
  const cashbox = asRecord(data.cashbox);
  return {
    cash: toFinite(cashbox.balance_cash ?? data.balance_cash ?? data.balanceCash ?? data.cash) ?? 0,
    card: toFinite(cashbox.balance_card ?? data.balance_card ?? data.balanceCard ?? data.transfer) ?? 0,
  };
};

const OpenShiftFlow = ({ open, onClose, onOpened, shiftOpen, openerName, onRefetchShift }: OpenShiftFlowProps) => {
  const { t } = useTranslation("payments");
  const role = useSelector((state: RootState) => state.role.role);
  const profile = useSelector((state: RootState) => state.user.user);
  const isManagerRole = String(role ?? "").toLowerCase() === "manager";
  // Menejer profili: `branch` — branch_users qatori, filial nomi ichki `branch.branch.name` da.
  const ownBranch = asRecord(asRecord(profile).branch);
  const ownBranchName = getText(asRecord(ownBranch.branch).name) || getText(ownBranch.name);

  const { openShift, useGetCashBoxMain } = useCashBox();
  const balanceQuery = useGetCashBoxMain(undefined, open);
  const split = balanceQuery.isSuccess ? readCashboxSplit(balanceQuery.data) : { cash: null, card: null };

  const cashboxLabel = isManagerRole
    ? ownBranchName
      ? t("v2MainCashbox.shift.branchCashbox", { branch: ownBranchName })
      : t("v2MainCashbox.shift.branchCashboxFallback")
    : t("v2MainCashbox.shift.mainCashbox");
  const cardLabel = isManagerRole ? t("v2MainCashbox.shift.card") : t("v2MainCashbox.shift.cardClick");

  const handleSubmit = useCallback(
    async (comment: string) => {
      if (openShift.isPending) return;
      try {
        await openShift.mutateAsync({ comment: comment || undefined });
      } catch {
        notify.error(t("common:error"), { description: t("openShiftError") });
        onRefetchShift();
        return;
      }
      onOpened();
      notify.success(t("common:success"), { description: t("openShiftSuccess") });
    },
    [onOpened, onRefetchShift, openShift, t],
  );

  // Smena (boshqa joyda) ochilib bo'lgan — oyna ortiqcha: yopiladi (qayta bosish yana 400 bermasin).
  useEffect(() => {
    if (open && shiftOpen) onOpened();
  }, [open, shiftOpen, onOpened]);

  return (
    <OpenShiftDialog
      open={open}
      onClose={onClose}
      onSubmit={(comment) => void handleSubmit(comment)}
      isLoading={openShift.isPending}
      openerName={openerName}
      cashboxLabel={cashboxLabel}
      cash={split.cash}
      card={split.card}
      cardLabel={cardLabel}
    />
  );
};

export default memo(OpenShiftFlow);
