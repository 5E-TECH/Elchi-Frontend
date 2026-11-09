import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { CircleX, Info, WifiOff, type LucideIcon } from "lucide-react";
import { formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatMoneyLocalized, resolveMoneyLanguage, type MoneyLanguage } from "../../../shared/lib/formatMoney";
import { Button, type ConfirmErrorControls, type ConfirmErrorView } from "../../../shared/ui/primitives";
import { readCorrectionError, type CorrectionError, type PaymentCorrectionErrorCode } from "./errors";
import { deletedCashboxSubject, type CorrectionShape } from "./target";
import { cashboxDeletedText, nowrapText } from "./texts";

/**
 * T6 N2 — xato kodi → tasdiq oynasidagi xato qutisi (maketlar `superadmin-payments-history-reverse-errors`,
 * `-correct-amount-errors`; ega qarorlari 2026-11-03). Xato tasdiq oynasining oxirida qoladi, oyna yopilmaydi.
 *
 *  - Tugmalar xatodan keyin yana faol — qayta urinish mumkin (maket). Istisno (`blockConfirm`): `AMOUNT_EXCEEDS` va
 *    `SAME_AMOUNT` (summa o'zgarmaguncha befoyda), `COURIER_MOVED`, `ALREADY_CORRECTED`, `NOT_FOUND` (doimiy holat).
 *  - `ALREADY_CORRECTED` — neytral quti (xato emas): «To'lov allaqachon tuzatilgan. Ro'yxat yangilandi.»; ro'yxat
 *    yangilanadi (mutatsiya hook'i), «Orqaga» butun oqimni yopadi (`closesFlow`).
 *  - Natija noma'lum (javob yo'q, 502–504) — `WifiOff` «Internet aloqasi yo'q»: o'sha kalit bilan qayta yuboriladi,
 *    to'lov ikki marta tuzatilmaydi.
 *  - Noma'lum kod va kalit xatolari (`IDEMPOTENCY_KEY_*`) — umumiy «Amalni bajarib bo'lmadi…» (backend matni emas).
 * Pul va sana bo'linmaydi.
 */

export type CorrectionAction = "reverse" | "edit";

export type CorrectionErrorKind = PaymentCorrectionErrorCode | "UNCERTAIN" | "GENERIC";

export type CorrectionErrorModel = {
  kind: CorrectionErrorKind;
  /** Qalin sarlavha; bitta jumlali xatoda (`COURIER_MOVED`) — `null`. */
  title: string | null;
  body: string;
  icon: LucideIcon;
  tone: "danger" | "neutral";
  /** Tasdiqlash tugmasi o'chadi (qayta urinish befoyda). */
  blockConfirm: boolean;
  /** Xato qutisidagi amal: «Smenani ochish» (`SHIFT_REQUIRED`). */
  action: "openShift" | null;
  /** «Orqaga» — butun oqim yopiladi (`ALREADY_CORRECTED`, ega qarori 2026-11-03). */
  closesFlow: boolean;
  /** Summani tahrirlash formasi holati (`correctionAmountState` ga): rad etilgan summa va chegara. */
  rejection: { code: "AMOUNT_EXCEEDS" | "SAME_AMOUNT"; max: number | null } | null;
  /** O'qilgan xato (status, kod, maydonlar, `uncertain`). */
  info: CorrectionError;
};

export type CorrectionErrorContext = { action: CorrectionAction; shape: CorrectionShape };

/**
 * «Smenani ochish» (`SHIFT_REQUIRED`): sahifa smena oynasini ochadi va smena ochilgach `onOpened` ni chaqiradi —
 * tasdiqdagi «Smena ochilmagan» qutisi olib tashlanadi (holat endi boshqa; «Smena ochildi» xabari bilan zid qolmasin).
 */
export type CorrectionOpenShift = (handlers: { onOpened: () => void }) => void;

type Ctx = { t: TFunction; language: MoneyLanguage };

const money = ({ language }: Ctx, value: number) => nowrapText(formatMoneyLocalized(value, { language }));

const capitalize = (value: string, language: MoneyLanguage) =>
  value ? value.charAt(0).toLocaleUpperCase(language) + value.slice(1) : value;

/** Ismlar (nom yoki umumiy so'z) — `texts.ts` dagi kabi (`paymentCorrection.party.*`). */
const party = ({ t }: Ctx, shape: CorrectionShape) => ({
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

/** «Kassada pul yetmaydi» matni: qabul qiluvchi kassa × usul; `required > 0` bo'lsa — «(kerak: …)». */
const insufficientBody = (ctx: Ctx, info: CorrectionError, shape: CorrectionShape) => {
  const { t, language } = ctx;
  const p = party(ctx, shape);
  const cash = shape.method === "cash";
  const base = (() => {
    switch (shape.kind) {
      case "market":
        return t("paymentCorrection.errors.insufficient.market");
      case "courier":
      case "clickToMarket":
        if (shape.receiver === "branch") {
          return capitalize(
            cash
              ? t("paymentCorrection.errors.insufficient.courierBranchCash", { branch: p.branch })
              : t("paymentCorrection.errors.insufficient.courierBranchCard", { branch: p.branch }),
            language,
          );
        }
        return cash
          ? t("paymentCorrection.errors.insufficient.courierMainCash")
          : t("paymentCorrection.errors.insufficient.courierMainCard");
      default:
        return t("paymentCorrection.errors.insufficient.generic");
    }
  })();
  const required = info.required ? t("paymentCorrection.errors.insufficient.required", { amount: money(ctx, info.required) }) : "";
  return `${base}${required}. ${t("paymentCorrection.errors.nothingChanged")}`;
};

const amountExceedsBody = (ctx: Ctx, shape: CorrectionShape) => {
  const { t } = ctx;
  const p = party(ctx, shape);
  switch (shape.kind) {
    case "market":
      return t("paymentCorrection.errors.amountExceeds.bodyMarket", { market: p.market });
    case "courier":
      return t("paymentCorrection.errors.amountExceeds.bodyCourier", { courier: p.courier });
    default:
      return t("paymentCorrection.errors.amountExceeds.bodyGeneric");
  }
};

/** Xato → ko'rinish modeli (sof; test va forma holati uchun). */
export const describeCorrectionError = (
  error: unknown,
  { action, shape }: CorrectionErrorContext,
  t: TFunction,
  language: MoneyLanguage,
): CorrectionErrorModel => {
  const ctx: Ctx = { t, language };
  const info = readCorrectionError(error);
  const base = {
    icon: CircleX,
    tone: "danger" as const,
    blockConfirm: false,
    action: null,
    closesFlow: false,
    rejection: null,
    info,
  };
  const p = party(ctx, shape);
  const unsupported = () => ({
    ...base,
    kind: "NOT_CORRECTABLE" as const,
    title: t("paymentCorrection.errors.notCorrectable.title"),
    body:
      info.reason === "reversal_row"
        ? t("paymentCorrection.errors.notCorrectable.reversalRow")
        : info.reason === "cashbox_deleted"
          ? // Backend qaysi kassa (yoki CLICK kartasi) ekanini aytmaydi — aniq bo'lsagina nomlanadi.
            cashboxDeletedText(t, deletedCashboxSubject(shape, "post"))
          : t("paymentCorrection.errors.notCorrectable.unsupported"),
  });

  switch (info.code) {
    case "SHIFT_REQUIRED":
      return {
        ...base,
        kind: info.code,
        title: t("paymentCorrection.errors.shiftRequired.title"),
        body: t("paymentCorrection.errors.shiftRequired.body"),
        action: "openShift",
      };
    case "BRANCH_SHIFT_REQUIRED":
      return {
        ...base,
        kind: info.code,
        title: t("paymentCorrection.errors.branchShiftRequired.title"),
        body: t("paymentCorrection.errors.branchShiftRequired.body", { branch: p.branch }),
      };
    case "INSUFFICIENT_BALANCE":
      return {
        ...base,
        kind: info.code,
        title: t("paymentCorrection.errors.insufficient.title"),
        body: insufficientBody(ctx, info, shape),
      };
    case "CARD_ARCHIVED":
      return {
        ...base,
        kind: info.code,
        title: t("paymentCorrection.errors.cardArchived.title"),
        body: t("paymentCorrection.errors.cardArchived.body"),
      };
    case "ALREADY_CORRECTED":
      return {
        ...base,
        kind: info.code,
        // Ega qarori (2026-11-03): bitta neytral jumla — sarlavhasiz.
        title: null,
        body: t("paymentCorrection.errors.alreadyCorrected.body"),
        icon: Info,
        tone: "neutral",
        blockConfirm: true,
        closesFlow: true,
      };
    case "WINDOW_EXPIRED":
      return {
        ...base,
        kind: info.code,
        title: info.deadline
          ? t("paymentCorrection.errors.windowExpired.title", {
              deadline: nowrapText(formatDateTimeLocalized(info.deadline, { language, relative: false })),
            })
          : t("paymentCorrection.errors.windowExpired.titleGeneric"),
        body: info.windowDays
          ? t("paymentCorrection.errors.windowExpired.body", { count: info.windowDays })
          : t("paymentCorrection.errors.windowExpired.bodyGeneric"),
      };
    case "COURIER_MOVED":
      return { ...base, kind: info.code, title: null, body: t("paymentCorrection.lock.courierMoved"), blockConfirm: true };
    case "NOT_CORRECTABLE":
      // correct-amount gateway tekshiruvi (kuryer yangi summani topshira olmaydi) — `reason` siz.
      if (!info.reason && action === "edit") {
        return {
          ...base,
          kind: info.code,
          title: t("paymentCorrection.errors.notCorrectable.amountTitle"),
          body: t("paymentCorrection.errors.notCorrectable.amountBody"),
        };
      }
      return unsupported();
    case "LEGACY_UNLINKED":
      return {
        ...base,
        kind: info.code,
        title: t("paymentCorrection.errors.legacy.title"),
        body: t("paymentCorrection.errors.legacy.body"),
      };
    case "AMOUNT_EXCEEDS":
      return {
        ...base,
        kind: info.code,
        title:
          info.max === null
            ? t("paymentCorrection.errors.amountExceeds.titleGeneric")
            : t("paymentCorrection.errors.amountExceeds.title", { max: money(ctx, info.max) }),
        body: amountExceedsBody(ctx, shape),
        blockConfirm: true,
        rejection: { code: "AMOUNT_EXCEEDS", max: info.max },
      };
    case "SAME_AMOUNT":
      return {
        ...base,
        kind: info.code,
        title: t("paymentCorrection.errors.sameAmount.title"),
        body: t("paymentCorrection.errors.sameAmount.body"),
        blockConfirm: true,
        rejection: { code: "SAME_AMOUNT", max: null },
      };
    case "NOT_FOUND":
      return {
        ...base,
        kind: info.code,
        title: t("paymentCorrection.errors.notFound.title"),
        body: t("paymentCorrection.errors.notFound.body"),
        blockConfirm: true,
      };
    default:
      break;
  }

  if (info.uncertain) {
    return {
      ...base,
      kind: "UNCERTAIN",
      title: t("paymentCorrection.errors.uncertain.title"),
      body: action === "reverse" ? t("paymentCorrection.errors.uncertain.reverse") : t("paymentCorrection.errors.uncertain.edit"),
      icon: WifiOff,
    };
  }
  return { ...base, kind: "GENERIC", title: null, body: t("paymentCorrection.errors.generic") };
};

/** Xato qutisi mazmuni: qalin sarlavha, matn, kerak bo'lsa amal (`Button variant="link" size="sm"`). */
export const renderCorrectionError = (
  model: CorrectionErrorModel,
  options: { onOpenShift?: () => void; openShiftLabel: string },
) => (
  <>
    {model.title ? <p className="m-0 font-bold">{model.title}</p> : null}
    <p className="m-0">{model.body}</p>
    {model.action === "openShift" && options.onOpenShift ? (
      <div className="mt-1">
        <Button variant="link" size="sm" className="-ml-1" onClick={options.onOpenShift}>
          {options.openShiftLabel}
        </Button>
      </div>
    ) : null}
  </>
);

/** Model → `ConfirmErrorView` (`useConfirm({ errorView })`). */
export const toConfirmErrorView = (
  model: CorrectionErrorModel,
  options: { onOpenShift?: () => void; openShiftLabel: string },
): ConfirmErrorView => ({
  content: renderCorrectionError(model, options),
  // Maket: xato ikonkasi 20 px (`CircleX`, oflaynda `WifiOff`, neytralda `Info`).
  icon: model.icon,
  tone: model.tone,
  blockConfirm: model.blockConfirm,
});

/**
 * Joriy til bilan: `describe` — model (forma holati: `rejection`, `closesFlow`), `view` — tasdiq oynasi uchun
 * (`errorView`, ikkinchi argument — uning `controls` i). `onOpenShift` — sahifa `OpenShiftFlow` ni ochadi (feature
 * sahifani import qilmaydi); smena ochilgach xato qutisi olib tashlanadi (`controls.dismiss`).
 */
export const usePaymentCorrectionErrors = () => {
  const { t, i18n } = useTranslation("payments");
  const language = resolveMoneyLanguage(i18n.language);
  return useMemo(
    () => ({
      describe: (error: unknown, context: CorrectionErrorContext) => describeCorrectionError(error, context, t, language),
      view: (
        error: unknown,
        context: CorrectionErrorContext & { onOpenShift?: CorrectionOpenShift },
        controls?: ConfirmErrorControls,
      ): ConfirmErrorView => {
        const { onOpenShift } = context;
        return toConfirmErrorView(describeCorrectionError(error, context, t, language), {
          onOpenShift: onOpenShift ? () => onOpenShift({ onOpened: () => controls?.dismiss() }) : undefined,
          openShiftLabel: t("paymentCorrection.errors.shiftRequired.action"),
        });
      },
    }),
    [t, language],
  );
};
