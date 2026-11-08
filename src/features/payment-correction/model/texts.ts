import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Bell, Building2, History, ShoppingBag, Store, Truck, Wallet, type LucideIcon } from "lucide-react";
import type { PaymentCorrectable } from "../../../entities/payments/paymentCorrection";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import {
  formatMoneyLocalized,
  formatNumberLocalized,
  formatSignedMoneyLocalized,
  resolveMoneyLanguage,
  type MoneyLanguage,
} from "../../../shared/lib/formatMoney";
import type { ConfirmParty, ConfirmTransfer } from "../../../shared/ui/primitives";
import { deriveCorrectionShape, type CorrectionFooterState, type CorrectionShape, type CorrectionTarget } from "./target";
import { CORRECTION_REASON_LIMITS, correctionAmountDiff, correctionReasonState } from "./validation";

/**
 * T6 N2 — «Qaytarish» va «Summani tahrirlash» oynalari, tasdiq, xabar va tafsilot pastki qismi matnlari (maketlar
 * `superadmin-payments-history-{reverse,correct-amount}-{dialog,confirm}`, `…-detail-dialog-{correctable,locked}`;
 * ega qarorlari 2026-11-03). Hammasi `payments` nomlar fazosida, `paymentCorrection.*`.
 *
 * Variantlar: to'lov turi (kuryer → MAIN / filial, marketga to'lov, kuryerdan marketga o'tkazma) × amal × yo'nalish
 * (summa kamaydi / oshdi) × usul (naqd / o'tkazma). Tomonlar `correctable.transfer` dan; nom kelmasa — umumiy so'z
 * («kuryer», «market», «filial» — o'z tilida), `transfer` umuman bo'lmasa — umumiy jumla (nomsiz, qayerdan → qayerga
 * yo'q). Gap boshidagi umumiy so'z bosh harf bilan.
 *
 * Pul va sana bo'linmaydi (maketdagi `white-space: nowrap`): bo'shliqlar — bo'linmas bo'shliq (U+00A0), matn
 * oddiy satr bo'lib qoladi (xabar, `aria` ham).
 */

const NBSP = "\u00a0";

/** Bo'linmas qilib (pul, sana): oddiy bo'shliqlar → U+00A0. */
export const nowrapText = (value: string) => value.replace(/ /g, NBSP);

const capitalize = (value: string, language: MoneyLanguage) =>
  value ? value.charAt(0).toLocaleUpperCase(language) + value.slice(1) : value;

export type CorrectionConsequence = { text: string; icon: LucideIcon };

type Ctx = { t: TFunction; language: MoneyLanguage };

const moneyOf = ({ language }: Ctx, value: number) => nowrapText(formatMoneyLocalized(value, { language }));
const numberOf = ({ language }: Ctx, value: number) => nowrapText(formatNumberLocalized(Math.round(value), { language }));
const signedOf = ({ language }: Ctx, value: number) => nowrapText(formatSignedMoneyLocalized(value, { language }));

/** Tomonlarning jumladagi ko'rinishi (nom yoki umumiy so'z; tilga mos shakl — locale'da). */
const partiesOf = ({ t }: Ctx, shape: CorrectionShape) => ({
  courier: shape.courier?.name
    ? t("paymentCorrection.party.courier", { name: shape.courier.name })
    : t("paymentCorrection.party.courierGeneric"),
  market: shape.market?.name
    ? t("paymentCorrection.party.market", { name: shape.market.name })
    : t("paymentCorrection.party.marketGeneric"),
  branch: shape.branch?.name
    ? t("paymentCorrection.party.branch", { name: shape.branch.name })
    : t("paymentCorrection.party.branchGeneric"),
});

/** To'lov usuli belgisi: «Naqd» yoki «O'tkazma» (karta, click, marketga o'tkazma); noma'lum — `null`. */
const methodBadgeOf = ({ t }: Ctx, shape: CorrectionShape) =>
  shape.method === "cash"
    ? t("v2Common.paymentMethod.cash")
    : shape.method
      ? t("v2Common.paymentMethod.transfer")
      : null;

/** Tur nomi: «Kuryer to'lovi» / «Market to'lovi»; shakl noma'lum — tafsilot oynasidagi sarlavha. */
const kindTitleOf = ({ t }: Ctx, shape: CorrectionShape, target: CorrectionTarget) =>
  shape.kind === "market"
    ? t("v2Common.sourceType.marketPayment")
    : shape.kind
      ? t("v2Common.sourceType.courierPayment")
      : target.title;

/** Tavsifdagi kontragent: market to'lovida — market, kuryer to'lovida — kuryer (faqat nom kelgan bo'lsa). */
const counterpartyOf = (shape: CorrectionShape) =>
  (shape.kind === "market" ? shape.market?.name : shape.courier?.name) ?? null;

/**
 * Tavsif (maket A4): qaytarish oynasi va tasdig'i — `#id · tur · vaqt`; tahrirlash oynasi — `#id · tur · kontragent ·
 * vaqt`; tahrirlash tasdig'i — `#id · tur · kontragent`.
 */
const descriptionOf = (
  ctx: Ctx,
  target: CorrectionTarget,
  shape: CorrectionShape,
  parts: { counterparty: boolean; time: boolean },
) =>
  [
    `#${target.id}`,
    kindTitleOf(ctx, shape, target),
    parts.counterparty ? counterpartyOf(shape) : null,
    parts.time && target.createdAt ? nowrapText(formatDateTimeLocalized(target.createdAt, { language: ctx.language })) : null,
  ]
    .filter(Boolean)
    .join(" · ");

/** Qayerdan → qayerga (asl yo'nalish); shakl noma'lum — `undefined` (qator chizilmaydi). */
const transferOf = ({ t }: Ctx, shape: CorrectionShape): ConfirmTransfer | undefined => {
  const courier: ConfirmParty = { title: t("v2Common.cashbox.courier"), meta: shape.courier?.name ?? undefined };
  const market: ConfirmParty = { title: t("v2Common.cashbox.market"), meta: shape.market?.name ?? undefined };
  const main: ConfirmParty = { title: t("v2Common.cashbox.main") };
  const branch: ConfirmParty = { title: t("v2Common.cashbox.branch"), meta: shape.branch?.name ?? undefined };
  switch (shape.kind) {
    case "courier":
      return { from: courier, to: shape.receiver === "branch" ? branch : main };
    case "market":
      return { from: main, to: market };
    case "clickToMarket":
      return { from: courier, to: market };
    default:
      return undefined;
  }
};

const swap = (transfer: ConfirmTransfer | undefined): ConfirmTransfer | undefined =>
  transfer ? { from: { ...transfer.to, label: undefined }, to: { ...transfer.from, label: undefined } } : undefined;

/** «Sabab» ko'rsatmasi: kim ilovada ko'radi (kuryer / market / ikkalasi); noma'lum — umumiy. */
const reasonHintOf = ({ t }: Ctx, shape: CorrectionShape) => {
  switch (shape.kind) {
    case "courier":
      return t("paymentCorrection.reason.hintCourier");
    case "market":
      return t("paymentCorrection.reason.hintMarket");
    case "clickToMarket":
      return t("paymentCorrection.reason.hintBoth");
    default:
      return t("paymentCorrection.reason.hintGeneric");
  }
};

/** «Sabab» maydoni: yorliq, namuna, ko'rsatma yoki xato, hisoblagich (`Field hintAside`). */
const reasonFieldOf = (ctx: Ctx, shape: CorrectionShape, action: "reverse" | "edit", value: string, touched: boolean) => {
  const { t } = ctx;
  const state = correctionReasonState(value);
  return {
    label: t("paymentCorrection.reason.label"),
    placeholder:
      action === "reverse" ? t("paymentCorrection.reason.placeholderReverse") : t("paymentCorrection.reason.placeholderEdit"),
    hint: state === "empty" ? t("paymentCorrection.reason.emptyHint") : reasonHintOf(ctx, shape),
    /** Qisqa sabab — maydon tark etilgach (tugma o'chiq, yuborish uni chiqarmaydi; maket «Sabab qisqa»). */
    error: touched && state === "short" ? t("paymentCorrection.reason.short") : undefined,
    counter: t("paymentCorrection.reason.counter", { length: value.length, max: CORRECTION_REASON_LIMITS.max }),
    maxLength: CORRECTION_REASON_LIMITS.max,
    valid: state === "valid",
  };
};

// ───────────────────────── Qaytarish ─────────────────────────

const reverseNoteOf = (ctx: Ctx, shape: CorrectionShape) => {
  const { t, language } = ctx;
  const p = partiesOf(ctx, shape);
  const amount = moneyOf(ctx, shape.amount);
  switch (shape.kind) {
    case "courier":
      return shape.receiver === "branch"
        ? t("paymentCorrection.reverse.note.courierBranch", { courier: p.courier, branch: p.branch })
        : t("paymentCorrection.reverse.note.courierMain", { courier: p.courier });
    case "market":
      return t("paymentCorrection.reverse.note.market", { market: p.market, amount });
    case "clickToMarket":
      return capitalize(t("paymentCorrection.reverse.note.clickToMarket", { courier: p.courier, market: p.market, amount }), language);
    default:
      return t("paymentCorrection.reverse.note.generic");
  }
};

const reverseConsequencesOf = (ctx: Ctx, shape: CorrectionShape): CorrectionConsequence[] => {
  const { t, language } = ctx;
  const p = partiesOf(ctx, shape);
  const amount = moneyOf(ctx, shape.amount);
  const cap = (text: string) => capitalize(text, language);
  const history = { text: t("paymentCorrection.reverse.consequence.history"), icon: History };
  switch (shape.kind) {
    case "courier":
      return shape.receiver === "branch"
        ? [
            { text: cap(t("paymentCorrection.reverse.consequence.branchOut", { branch: p.branch, amount })), icon: Building2 },
            { text: cap(t("paymentCorrection.reverse.consequence.courierBack", { courier: p.courier, amount })), icon: Truck },
            { text: t("paymentCorrection.consequence.notifyCourierBranch"), icon: Bell },
            history,
          ]
        : [
            {
              text:
                shape.method === "cash"
                  ? t("paymentCorrection.reverse.consequence.mainOutCash", { amount })
                  : t("paymentCorrection.reverse.consequence.mainOut", { amount }),
              icon: Wallet,
            },
            { text: cap(t("paymentCorrection.reverse.consequence.courierBack", { courier: p.courier, amount })), icon: Truck },
            { text: t("paymentCorrection.consequence.notifyCourier"), icon: Bell },
            history,
          ];
    case "market":
      return [
        { text: t("paymentCorrection.reverse.consequence.mainIn", { amount }), icon: Wallet },
        { text: cap(t("paymentCorrection.consequence.marketOwedUp", { market: p.market, amount })), icon: Store },
        { text: t("paymentCorrection.reverse.consequence.marketOrders"), icon: ShoppingBag },
        { text: t("paymentCorrection.consequence.notifyMarket"), icon: Bell },
        history,
      ];
    case "clickToMarket":
      return [
        { text: cap(t("paymentCorrection.consequence.courierBack", { courier: p.courier, amount })), icon: Truck },
        { text: cap(t("paymentCorrection.consequence.marketOwedUp", { market: p.market, amount })), icon: Store },
        { text: t("paymentCorrection.consequence.mainUnchanged"), icon: Wallet },
        { text: t("paymentCorrection.consequence.notifyBoth"), icon: Bell },
        history,
      ];
    default:
      return [
        { text: t("paymentCorrection.reverse.consequence.generic"), icon: Wallet },
        { text: t("paymentCorrection.consequence.notifyGeneric"), icon: Bell },
        history,
      ];
  }
};

const reverseToastOf = (ctx: Ctx, target: CorrectionTarget, shape: CorrectionShape) => {
  const { t, language } = ctx;
  const p = partiesOf(ctx, shape);
  const amount = moneyOf(ctx, shape.amount);
  const description = (() => {
    switch (shape.kind) {
      case "courier":
        return t("paymentCorrection.reverse.toast.courier", { amount, courier: p.courier });
      case "market":
        return t("paymentCorrection.reverse.toast.market", { amount, market: p.market });
      case "clickToMarket":
        return t("paymentCorrection.reverse.toast.clickToMarket", { amount, courier: p.courier });
      default:
        return t("paymentCorrection.reverse.toast.generic", { id: target.id, amount });
    }
  })();
  return { title: t("paymentCorrection.reverse.toast.title"), description: capitalize(description, language) };
};

/** «To'lovni qaytarish» oynasi, tasdig'i va natija xabari. */
const buildReverseTexts = (ctx: Ctx, target: CorrectionTarget) => {
  const { t } = ctx;
  const shape = deriveCorrectionShape(target);
  const transfer = transferOf(ctx, shape);
  return {
    shape,
    /** Forma oynasi (`Dialog`, `RotateCcw`). */
    title: t("paymentCorrection.reverse.title"),
    description: descriptionOf(ctx, target, shape, { counterparty: false, time: true }),
    amountLabel: t("paymentCorrection.reverse.amountLabel"),
    methodBadge: methodBadgeOf(ctx, shape),
    /** Asl yo'nalish (forma xulosasi). */
    transfer,
    note: reverseNoteOf(ctx, shape),
    reasonField: (value: string, touched: boolean) => reasonFieldOf(ctx, shape, "reverse", value, touched),
    cancelLabel: t("paymentCorrection.cancel"),
    continueLabel: t("paymentCorrection.continue"),
    /** Tasdiq (`useConfirm`, `tone: "danger"`). */
    confirm: {
      title: t("paymentCorrection.reverse.confirmTitle"),
      description: descriptionOf(ctx, target, shape, { counterparty: false, time: true }),
      /** Teskari yo'nalish: pul qaytadigan tomonga. */
      transfer: swap(transfer),
      reasonLabel: t("paymentCorrection.reason.label"),
      consequences: reverseConsequencesOf(ctx, shape),
      irreversible: t("paymentCorrection.reverse.irreversible"),
      cancelLabel: t("paymentCorrection.back"),
      confirmLabel: t("paymentCorrection.reverse.confirmLabel"),
      loadingLabel: t("paymentCorrection.reverse.loading"),
    },
    toast: reverseToastOf(ctx, target, shape),
  };
};

// ───────────────────────── Summani tahrirlash ─────────────────────────

const correctDiffLineOf = (ctx: Ctx, shape: CorrectionShape, diff: number) => {
  if (!diff) return null;
  const { t, language } = ctx;
  const p = partiesOf(ctx, shape);
  const d = moneyOf(ctx, Math.abs(diff));
  const up = diff > 0;
  const cap = (text: string) => capitalize(text, language);
  switch (shape.kind) {
    case "market":
      return up
        ? t("paymentCorrection.correct.diffLine.marketIncrease", { diff: d, market: p.market })
        : t("paymentCorrection.correct.diffLine.marketDecrease", { diff: d, market: p.market });
    case "courier":
      if (shape.receiver === "branch") {
        return cap(
          up
            ? t("paymentCorrection.correct.diffLine.courierBranchIncrease", { diff: d, courier: p.courier, branch: p.branch })
            : t("paymentCorrection.correct.diffLine.courierBranchDecrease", { diff: d, courier: p.courier, branch: p.branch }),
        );
      }
      return cap(
        up
          ? t("paymentCorrection.correct.diffLine.courierMainIncrease", { diff: d, courier: p.courier })
          : t("paymentCorrection.correct.diffLine.courierMainDecrease", { diff: d, courier: p.courier }),
      );
    case "clickToMarket":
      return cap(
        up
          ? t("paymentCorrection.correct.diffLine.clickToMarketIncrease", { diff: d, courier: p.courier, market: p.market })
          : t("paymentCorrection.correct.diffLine.clickToMarketDecrease", { diff: d, courier: p.courier, market: p.market }),
      );
    default:
      return null;
  }
};

/**
 * Tarix qatori (`History`): teskari yozuv va yangi to'lov ishoralari — qabul qiluvchi (MAIN / filial) kassa tomonidan.
 * Marketga to'lovda MAIN chiqim edi: teskari `+X`, yangi `−N`; kuryer to'lovida MAIN / filial kirim edi: teskari `−X`,
 * yangi `+N` (maketdagi market holati; kuryer holatida maket bu qatorni ko'rsatmaydi — ega qarori bilan qoldirilgan).
 */
const correctHistoryOf = (ctx: Ctx, shape: CorrectionShape, current: number, next: number): CorrectionConsequence => {
  const outgoing = shape.kind === "market";
  return {
    text: ctx.t("paymentCorrection.correct.consequence.history", {
      reversal: signedOf(ctx, outgoing ? current : -current),
      replacement: signedOf(ctx, outgoing ? -next : next),
    }),
    icon: History,
  };
};

const correctConsequencesOf = (ctx: Ctx, shape: CorrectionShape, current: number, next: number): CorrectionConsequence[] => {
  const { t, language } = ctx;
  const p = partiesOf(ctx, shape);
  const diff = correctionAmountDiff(next, current);
  const d = moneyOf(ctx, Math.abs(diff));
  const up = diff > 0;
  const cap = (text: string) => capitalize(text, language);
  const history = correctHistoryOf(ctx, shape, current, next);
  switch (shape.kind) {
    case "market":
      return [
        up
          ? { text: t("paymentCorrection.correct.consequence.mainMore", { diff: d }), icon: Wallet }
          : { text: t("paymentCorrection.correct.consequence.mainBack", { diff: d }), icon: Wallet },
        up
          ? { text: cap(t("paymentCorrection.correct.consequence.marketOwedDown", { diff: d, market: p.market })), icon: Store }
          : { text: cap(t("paymentCorrection.correct.consequence.marketOwedUp", { diff: d, market: p.market })), icon: Store },
        history,
        { text: t("paymentCorrection.consequence.notifyMarket"), icon: Bell },
      ];
    case "courier": {
      const courierRow = up
        ? { text: cap(t("paymentCorrection.correct.consequence.courierMore", { diff: d, courier: p.courier })), icon: Truck }
        : { text: cap(t("paymentCorrection.consequence.courierBack", { amount: d, courier: p.courier })), icon: Truck };
      if (shape.receiver === "branch") {
        return [
          courierRow,
          up
            ? { text: cap(t("paymentCorrection.correct.consequence.branchIn", { diff: d, branch: p.branch })), icon: Building2 }
            : { text: cap(t("paymentCorrection.correct.consequence.branchOut", { diff: d, branch: p.branch })), icon: Building2 },
          history,
          { text: t("paymentCorrection.consequence.notifyCourierBranch"), icon: Bell },
        ];
      }
      const mainRow = up
        ? { text: t("paymentCorrection.correct.consequence.mainIn", { diff: d }), icon: Wallet }
        : shape.method === "cash"
          ? { text: t("paymentCorrection.correct.consequence.mainOutCash", { diff: d }), icon: Wallet }
          : { text: t("paymentCorrection.correct.consequence.mainOut", { diff: d }), icon: Wallet };
      return [courierRow, mainRow, history, { text: t("paymentCorrection.correct.consequence.notifyCourier"), icon: Bell }];
    }
    case "clickToMarket":
      return [
        up
          ? { text: cap(t("paymentCorrection.correct.consequence.courierMore", { diff: d, courier: p.courier })), icon: Truck }
          : { text: cap(t("paymentCorrection.consequence.courierBack", { amount: d, courier: p.courier })), icon: Truck },
        up
          ? { text: cap(t("paymentCorrection.correct.consequence.marketOwedDown", { diff: d, market: p.market })), icon: Store }
          : { text: cap(t("paymentCorrection.correct.consequence.marketOwedUp", { diff: d, market: p.market })), icon: Store },
        { text: t("paymentCorrection.consequence.mainUnchanged"), icon: Wallet },
        history,
        { text: t("paymentCorrection.consequence.notifyBoth"), icon: Bell },
      ];
    default:
      return [history, { text: t("paymentCorrection.consequence.notifyGeneric"), icon: Bell }];
  }
};

const correctToastOf = (ctx: Ctx, target: CorrectionTarget, shape: CorrectionShape, current: number, next: number) => {
  const { t } = ctx;
  const values = { id: target.id, from: numberOf(ctx, current), to: moneyOf(ctx, next) };
  const description = (() => {
    switch (shape.kind) {
      case "courier":
        return t("paymentCorrection.correct.toast.courier", values);
      case "market":
        return t("paymentCorrection.correct.toast.market", values);
      case "clickToMarket":
        return t("paymentCorrection.correct.toast.clickToMarket", values);
      default:
        return t("paymentCorrection.correct.toast.generic", values);
    }
  })();
  return { title: t("paymentCorrection.correct.toast.title"), description };
};

/** Tasdiqdagi eslatma: yangi to'lovni zanjirning birinchi to'lovi muddatigacha yana tuzatish mumkin. */
const correctDeadlineNoteOf = ({ t, language }: Ctx, correctable: PaymentCorrectable) =>
  correctable.deadline
    ? t("paymentCorrection.correct.deadlineNote", {
        deadline: nowrapText(formatDateTimeLocalized(correctable.deadline, { language, relative: false })),
      })
    : null;

/** «Summani tahrirlash» oynasi; `next` — kiritilgan yangi summa (tasdiq, «Farq», xabar uchun; bo'lmasa `null`). */
const buildCorrectTexts = (ctx: Ctx, target: CorrectionTarget, next: number | null) => {
  const { t } = ctx;
  const shape = deriveCorrectionShape(target);
  const current = shape.amount;
  const diff = next === null ? null : correctionAmountDiff(next, current);
  return {
    shape,
    current,
    title: t("paymentCorrection.correct.title"),
    description: descriptionOf(ctx, target, shape, { counterparty: true, time: true }),
    amountLabel: t("paymentCorrection.correct.currentLabel"),
    methodBadge: methodBadgeOf(ctx, shape),
    transfer: transferOf(ctx, shape),
    newAmountLabel: t("paymentCorrection.correct.newAmountLabel"),
    newAmountHint: t("paymentCorrection.correct.newAmountHint"),
    /** Maydon xatolari (`correctionAmountState` bo'yicha). */
    amountErrors: {
      zero: t("paymentCorrection.correct.zero"),
      same: t("paymentCorrection.correct.same"),
      exceeds: (max: number | null) =>
        max === null ? t("paymentCorrection.errors.amountExceeds.titleGeneric") : t("paymentCorrection.correct.exceeds", { max: moneyOf(ctx, max) }),
    },
    diffLabel: t("paymentCorrection.correct.diff"),
    /** «Farq» — ishorali, rangsiz (`+200 000 so'm` / `−400 000 so'm`). */
    diffText: diff === null ? null : signedOf(ctx, diff),
    /** «Farq» ostidagi izoh (shakl noma'lum — `null`). */
    diffLine: diff === null ? null : correctDiffLineOf(ctx, shape, diff),
    reasonField: (value: string, touched: boolean) => reasonFieldOf(ctx, shape, "edit", value, touched),
    cancelLabel: t("paymentCorrection.cancel"),
    continueLabel: t("paymentCorrection.continue"),
    /** Tasdiq (`useConfirm`, `tone: "primary"`, `Pencil`). */
    confirm: {
      title: t("paymentCorrection.correct.confirmTitle"),
      description: descriptionOf(ctx, target, shape, { counterparty: true, time: false }),
      rows: {
        currentLabel: t("paymentCorrection.correct.currentLabel"),
        current: moneyOf(ctx, current),
        nextLabel: t("paymentCorrection.correct.newAmountLabel"),
        next: next === null ? null : moneyOf(ctx, next),
        diffLabel: t("paymentCorrection.correct.diff"),
        diff: diff === null ? null : signedOf(ctx, diff),
        reasonLabel: t("paymentCorrection.reason.label"),
      },
      consequences: next === null ? [] : correctConsequencesOf(ctx, shape, current, next),
      note: correctDeadlineNoteOf(ctx, target.correctable),
      cancelLabel: t("paymentCorrection.back"),
      confirmLabel: t("paymentCorrection.correct.confirmLabel"),
      loadingLabel: t("paymentCorrection.correct.loading"),
    },
    toast: next === null ? null : correctToastOf(ctx, target, shape, current, next),
  };
};

// ───────────────────────── Tafsilot oynasi pastki qismi ─────────────────────────

/**
 * Muddat izohi (maket `-correctable`): «Qaytarish yoki tahrirlash mumkin: **{deadline} gacha** · muddat {n} kun»;
 * zanjir davomida (`root_history_id ≠ id`) — «… · muddat birinchi to'lovdan (#{root})». `until` — qalin, bo'linmas.
 */
const deadlineHintOf = ({ t, language }: Ctx, state: Extract<CorrectionFooterState, { kind: "actions" }>) => ({
  lead: t("paymentCorrection.deadline.lead"),
  until: state.deadline
    ? nowrapText(
        t("paymentCorrection.deadline.until", {
          deadline: formatDateTimeLocalized(state.deadline, { language, relative: false }),
        }),
      )
    : null,
  window:
    state.chained && state.rootHistoryId
      ? nowrapText(t("paymentCorrection.deadline.fromRoot", { id: state.rootHistoryId }))
      : t("paymentCorrection.deadline.window", { count: state.windowDays }),
});

/**
 * Qulf izohi (maket `-locked`, `role="note"`, `Lock` 20): sarlavha (bo'lmasligi mumkin — `COURIER_MOVED` bitta jumla)
 * va matn; `WINDOW_EXPIRED` da «Muddatni o'zgartirish» havolasi (`/payments/shift-settings`).
 */
const lockOf = (ctx: Ctx, correctable: PaymentCorrectable) => {
  const { t, language } = ctx;
  const kind = correctable.transfer?.kind ?? null;
  switch (correctable.code) {
    case "WINDOW_EXPIRED":
      return {
        title: correctable.deadline
          ? t("paymentCorrection.lock.windowExpiredTitle", {
              deadline: nowrapText(formatDateTimeLocalized(correctable.deadline, { language, relative: false })),
            })
          : t("paymentCorrection.lock.windowExpiredTitleGeneric"),
        body: t("paymentCorrection.lock.windowExpiredBody", { count: correctable.window_days }),
        changeWindow: t("paymentCorrection.lock.changeWindow"),
      };
    case "LEGACY_UNLINKED":
      return {
        title: t("paymentCorrection.errors.legacy.title"),
        body: t("paymentCorrection.errors.legacy.body"),
        changeWindow: null,
      };
    case "COURIER_MOVED":
      return { title: null, body: t("paymentCorrection.lock.courierMoved"), changeWindow: null };
    case "NOT_CORRECTABLE":
      return {
        title: t("paymentCorrection.errors.notCorrectable.title"),
        body:
          correctable.reason === "reversal_row"
            ? t("paymentCorrection.errors.notCorrectable.reversalRow")
            : correctable.reason === "cashbox_deleted"
              ? kind === "market_payment"
                ? t("paymentCorrection.errors.notCorrectable.marketCashboxDeleted")
                : kind === "courier_payment"
                  ? t("paymentCorrection.errors.notCorrectable.courierCashboxDeleted")
                  : t("paymentCorrection.errors.notCorrectable.cashboxDeleted")
              : t("paymentCorrection.errors.notCorrectable.unsupported"),
        changeWindow: null,
      };
    default:
      return null;
  }
};

/** Matn quruvchilari (bitta `t` va til bilan). */
export const createCorrectionTexts = (t: TFunction, language: MoneyLanguage) => {
  const ctx: Ctx = { t, language };
  return {
    language,
    reverse: (target: CorrectionTarget) => buildReverseTexts(ctx, target),
    correct: (target: CorrectionTarget, next: number | null) => buildCorrectTexts(ctx, target, next),
    deadlineHint: (state: Extract<CorrectionFooterState, { kind: "actions" }>) => deadlineHintOf(ctx, state),
    lock: (correctable: PaymentCorrectable) => lockOf(ctx, correctable),
    /** Tafsilot pastki qismi tugmalari. */
    actions: {
      reverse: t("paymentCorrection.actions.reverse"),
      correct: t("paymentCorrection.actions.correct"),
    },
    money: (value: number) => moneyOf(ctx, value),
  };
};

export type CorrectionTexts = ReturnType<typeof createCorrectionTexts>;
export type ReverseTexts = ReturnType<CorrectionTexts["reverse"]>;
export type CorrectTexts = ReturnType<CorrectionTexts["correct"]>;

/** Joriy til bilan matn quruvchilari (`payments` nomlar fazosi). */
export const usePaymentCorrectionTexts = (): CorrectionTexts => {
  const { t, i18n } = useTranslation("payments");
  const language = resolveMoneyLanguage(i18n.language);
  return useMemo(() => createCorrectionTexts(t, language), [t, language]);
};
