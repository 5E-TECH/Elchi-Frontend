import { useTranslation } from "react-i18next";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ClipboardList,
  Lock,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import type { MovementType, WarehouseActor, WarehouseMovement } from "../../../entities/warehouse";
import { getErrorKind, getErrorStatus } from "../../../shared/lib/errorKind";
import { formatDateLocalized, formatDateTimeLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";

/** Harakat ikonkasi (maket `superadmin-warehouse-detail` «Oxirgi harakatlar»). */
export const MOVEMENT_ICON: Record<MovementType, LucideIcon> = {
  IN: ArrowDownLeft,
  RESERVE: Lock,
  OUT: ArrowUpRight,
  RELEASE: RotateCcw,
  RETURN: RotateCcw,
  ADJUST: ClipboardList,
  MOVE_OUT: ArrowLeftRight,
  MOVE_IN: ArrowLeftRight,
};

/** Qoldiqqa ta'sir qiladigan harakat (ishora bilan): kirim, chiqim, qaytish, tuzatish. Band — faqat «band». */
const ON_HAND_TYPES: ReadonlySet<MovementType> = new Set(["IN", "OUT", "RETURN", "ADJUST", "MOVE_IN", "MOVE_OUT"]);

/**
 * Ombor ekranlari matni: son va dona («486 dona»), sana («Bugun, 14:40»), harakat yorlig'i va sarlavhasi
 * («Kirim» · «Admin mahsulot qo'shdi», «Chiqim» · «Buyurtma №10238 kuryerga berildi»), muallif («Nilufar
 * Rashidova, admin»), saqlash xatosi izohi (xom backend matni ko'rsatilmaydi).
 */
export const useWarehouseText = () => {
  const { t, i18n } = useTranslation("warehouses");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const number = (value: number) => formatNumberLocalized(value, { language });
  /** «486 dona». */
  const pcs = (value: number) => t("units.pcs", { count: value, value: number(value) });
  /** Ishorali dona: «+40 dona», «−2 dona» (nol — ishorasiz). */
  const signedPcs = (value: number) => {
    if (value > 0) return t("units.pcsSigned", { count: value, value: `+${number(value)}` });
    return t("units.pcs", { count: Math.abs(value), value: number(value) });
  };
  const dateTime = (value: string | null | undefined) => formatDateTimeLocalized(value ?? null, { language });
  const date = (value: string | null | undefined) => formatDateLocalized(value ?? null, { language });

  const movementLabel = (type: MovementType) => t(`movement.type.${type}`);

  /** Harakat sarlavhasi: buyurtma raqami bilan; tuzatishda «Inventarizatsiya: 8 → 6». */
  const movementTitle = (movement: Pick<WarehouseMovement, "type" | "orderId" | "qty" | "onHandAfter">) => {
    // Buyurtma raqami — mingliklarsiz («№10241»), xuddi buyurtmalar ro'yxatidagidek.
    const orderText = movement.orderId;
    switch (movement.type) {
      case "ADJUST":
        return t("movement.title.ADJUST", {
          before: number(movement.onHandAfter - movement.qty),
          after: number(movement.onHandAfter),
        });
      case "RESERVE":
      case "OUT":
      case "RELEASE":
      case "RETURN":
        return orderText ? t(`movement.title.${movement.type}`, { order: orderText }) : t(`movement.titleNoOrder.${movement.type}`);
      default:
        return t(`movement.title.${movement.type}`);
    }
  };

  /** Miqdor ko'rinishi: qoldiq harakati — ishorali, band — ishorasiz. `positive` — yashil (kirim, qaytish). */
  const movementAmount = (movement: Pick<WarehouseMovement, "type" | "qty">) => {
    if (!ON_HAND_TYPES.has(movement.type)) return { text: pcs(Math.abs(movement.qty)), positive: false };
    return { text: signedPcs(movement.qty), positive: movement.qty > 0 && movement.type !== "ADJUST" };
  };

  /** Ro'yxatdagi qisqa xulosa: «Kirim · +40 dona», «Chiqim · №10236». */
  const lastMovementSummary = (movement: Pick<WarehouseMovement, "type" | "qty" | "orderId">) =>
    movement.orderId
      ? t("list.lastMovementOrder", { type: movementLabel(movement.type), order: movement.orderId })
      : t("list.lastMovementQty", { type: movementLabel(movement.type), qty: movementAmount(movement).text });

  /** «Nilufar Rashidova, admin» (rol bo'lmasa — faqat ism). */
  const actorText = (actor: WarehouseActor | null) => {
    if (!actor?.name) return null;
    const role = actor.role ? t(`actorRole.${actor.role.toLowerCase()}`, { defaultValue: "" }) : "";
    return role ? t("movement.actor", { name: actor.name, role }) : actor.name;
  };

  /** Saqlash xatosi izohi — faqat i18n. */
  const writeError = (error: unknown) => {
    const kind = getErrorKind(error);
    if (kind === "offline") return t("states.error.offline.description", { ns: "ui" });
    if (kind === "timeout") return t("states.error.timeout.description", { ns: "ui" });
    if (kind === "forbidden") return t("errors.forbidden");
    const status = getErrorStatus(error);
    if (status === 404) return t("errors.notFound");
    if (status === 409) return t("errors.conflict");
    if (status === 400 || status === 422) return t("errors.invalid");
    return t("states.error.generic.descriptionNoStatus", { ns: "ui" });
  };

  return {
    t,
    language,
    number,
    pcs,
    signedPcs,
    date,
    dateTime,
    movementLabel,
    movementTitle,
    movementAmount,
    lastMovementSummary,
    actorText,
    writeError,
  };
};

export type WarehouseText = ReturnType<typeof useWarehouseText>;
