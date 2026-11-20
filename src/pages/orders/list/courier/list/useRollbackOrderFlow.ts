import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { orderByIdQueryOptions } from "../../../../../entities/orders";
import { readRollbackEligibility } from "../../../../../entities/orders/rollbackEligibility";
import {
  classifyRollbackError,
  isRetryableRollbackError,
  type RollbackErrorKind,
} from "../../../../../entities/orders/rollbackError";
import type { RollbackTarget } from "../../../../../entities/orders/rollbackTarget";
import { notifyRollbackDone, type ActionOrder } from "./orderActionModel";

/**
 * QAYTARISH OYNASI OQIMI (BE #738) — ro'yxat (menejer, kuryer) va tafsilot sahifasi bir xil ishlaydi:
 *  - xato OYNA ICHIDA (`RollbackOrderDialog error`), toast emas: server matni (`message`) so'zma-so'z;
 *  - qayta urinish mumkin bo'lgan xatoda (`STATE_CHANGED`, 503, 409, 422, javob kelmadi) asosiy tugma «Qayta urinish»
 *    bo'ladi; `STATE_CHANGED` da avval buyurtma qayta o'qiladi (`GET /orders/:id` — yangi `rollback` maydoni): ruxsat
 *    endi yo'q bo'lsa — sababi, bo'lsa — ayni `Idempotency-Key` bilan qayta yuboriladi;
 *  - aniq rad etishda (`SUPERADMIN_ONLY`, `PARCEL_NOT_IN_BRANCH`, `CORRECTION_REQUIRED` …) asosiy tugma o'chiq —
 *    sabab o'qiladi, «Orqaga» bilan yopiladi;
 *  - muvaffaqiyat va har xatodan keyin buyurtmalar keshi yangilanadi (`RollbackOrder` mutatsiyasining o'zi).
 */

export type RollbackDialogError = {
  kind: RollbackErrorKind;
  message: string;
  /** Sabab ostidagi ikkinchi qator (nima qilish kerak). */
  hint: string | null;
  /** `true` — asosiy tugma «Qayta urinish»; `false` — o'chiq (qaror aniq). */
  retry: boolean;
};

type RollbackMutation = {
  mutate: (
    variables: { orderId: string; targetStatus: RollbackTarget },
    options?: { onSuccess?: (response: unknown) => void; onError?: (error: unknown) => void },
  ) => void;
  isPending: boolean;
};

export const describeRollbackError = (error: unknown, t: TFunction): RollbackDialogError => {
  const info = classifyRollbackError(error);
  const retry = isRetryableRollbackError(info.kind);
  const base = { kind: info.kind, retry };
  switch (info.kind) {
    case "state_changed":
      return {
        ...base,
        message: info.serverMessage ?? t("orders:rollbackErrorStateChanged"),
        hint: t("orders:rollbackErrorStateChangedHint"),
      };
    case "unavailable":
      return {
        ...base,
        message: info.serverMessage ?? t("orders:rollbackErrorUnavailable"),
        hint: t("orders:rollbackErrorUnavailableHint"),
      };
    case "in_progress":
      return { ...base, message: t("orders:rollbackErrorInProgress"), hint: null };
    case "key_mismatch":
      return { ...base, message: t("orders:rollbackErrorKeyMismatch"), hint: null };
    case "no_response":
      return { ...base, message: t("orders:rollbackErrorNoResponse"), hint: t("orders:rollbackErrorNoResponseHint") };
    default:
      return { ...base, message: info.serverMessage ?? t("orders:orderActionError"), hint: null };
  }
};

/** `GET /orders/:id` javobidan buyurtma yozuvi (`{ data: order }` yoki o'zi). */
const unwrapOrder = (body: unknown): Record<string, unknown> | null => {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const data = record.data;
  if (data && typeof data === "object" && !Array.isArray(data) && "id" in data) return data as Record<string, unknown>;
  return "id" in record ? record : null;
};

export const useRollbackOrderFlow = <T extends ActionOrder>({
  mutation,
  onSuccess,
}: {
  mutation: RollbackMutation;
  /** Muvaffaqiyat (sukut — `notifyRollbackDone`): kuryer pochta ogohlantirishi, tafsilotda tarix yangilanishi. */
  onSuccess?: (response: unknown, order: T, target: RollbackTarget) => void;
}) => {
  const { t } = useTranslation(["orders", "common"]);
  const client = useQueryClient();
  const [order, setOrder] = useState<T | null>(null);
  const [error, setError] = useState<RollbackDialogError | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const busy = mutation.isPending || refreshing;

  const open = useCallback((next: T) => {
    setError(null);
    setOrder(next);
  }, []);

  const close = useCallback(() => {
    if (busy) return;
    setOrder(null);
    setError(null);
  }, [busy]);

  const send = useCallback(
    (current: T, target: RollbackTarget) => {
      mutation.mutate(
        { orderId: current.id, targetStatus: target },
        {
          onSuccess: (response) => {
            setOrder(null);
            setError(null);
            if (onSuccess) onSuccess(response, current, target);
            else notifyRollbackDone(current, target, response);
          },
          onError: (reason) => setError(describeRollbackError(reason, t)),
        },
      );
    },
    [mutation, onSuccess, t],
  );

  const confirm = useCallback(
    async (target: RollbackTarget) => {
      if (!order || busy) return;
      let current = order;
      if (error?.kind === "state_changed") {
        // «Holat o'zgardi» — avval buyurtmani qayta o'qish: yangi ruxsat (`rollback`) va holat.
        setError(null);
        setRefreshing(true);
        const fresh = await client
          .fetchQuery({ ...orderByIdQueryOptions(current.id), staleTime: 0 })
          .then(unwrapOrder)
          .catch(() => null);
        setRefreshing(false);
        if (fresh) {
          const status = typeof fresh.status === "string" && fresh.status ? fresh.status : current.status;
          current = { ...current, status };
          setOrder(current);
        }
        const eligibility = readRollbackEligibility(fresh);
        if (eligibility && !eligibility.allowed) {
          setError({
            kind: "rejected",
            message: eligibility.message ?? t("orders:orderActionError"),
            hint: null,
            retry: false,
          });
          return;
        }
      }
      setError(null);
      send(current, target);
    },
    [busy, client, error?.kind, order, send, t],
  );

  /** Maqsad holat almashtirildi — avvalgi xato endi tegishli emas (boshqa so'rov). */
  const clearError = useCallback(() => setError(null), []);

  return {
    /** Ochiq oynadagi buyurtma (`null` — yopiq). */
    order,
    open,
    close,
    dialogProps: {
      order,
      loading: busy,
      error,
      onCancel: close,
      onConfirm: (target: RollbackTarget) => void confirm(target),
      onTargetChange: clearError,
    },
  };
};
