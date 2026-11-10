import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import {
  isIntakeUnsupportedError,
  isOrderIntakeClosed,
  isOrderReceiveClosed,
  normalizeOrderIntake,
  UNSUPPORTED_INTAKE,
  type OrderIntakeSettingsPatch,
  type OrderIntakeState,
} from "./model";

/** Bugungi qabul holati — bitta kesh (sarlavha, yaratish sahifasi). */
export const ORDER_INTAKE_KEY = ["order-intake"] as const;

const fetchOrderIntake = async (): Promise<OrderIntakeState> => {
  try {
    const response = await api.get(API_ENDPOINTS.ORDERS.INTAKE_SETTINGS);
    return normalizeOrderIntake(response.data);
  } catch (error) {
    // Backend hali chiqmagan — funksiya yo'q (xato emas, hech narsa to'silmaydi).
    if (isIntakeUnsupportedError(error)) return UNSUPPORTED_INTAKE;
    throw error;
  }
};

/**
 * Keyingi chegara (yaratish va qabulning `closes_at` / `reopens_at`) kelganda qayta chiziladi: 10:00 da yaratish
 * sahifasi, 16:00 da «Qabul qilish» so'rovsiz yopiladi; kun almashganda holat qayta so'raladi.
 */
const useBoundaryNow = (state: OrderIntakeState) => {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const { closesAt, reopensAt, receiveClosesAt, receiveReopensAt } = state;
  useEffect(() => {
    const reopened = [reopensAt, receiveReopensAt].some((value) => {
      const reopens = value ? Date.parse(value) : null;
      return reopens !== null && now >= reopens;
    });
    if (reopened) void queryClient.invalidateQueries({ queryKey: ORDER_INTAKE_KEY });
    const upcoming = [closesAt, reopensAt, receiveClosesAt, receiveReopensAt]
      .map((value) => (value ? Date.parse(value) : Number.NaN))
      .filter((time) => Number.isFinite(time) && time > now);
    if (upcoming.length === 0) return undefined;
    // `setTimeout` chegarasi ~24,8 kun — undan uzoq bo'lsa keyinroq qayta hisoblanadi.
    const delay = Math.min(Math.min(...upcoming) - now + 250, 2_147_000_000);
    const timer = window.setTimeout(() => setNow(Date.now()), delay);
    return () => window.clearTimeout(timer);
  }, [closesAt, now, queryClient, receiveClosesAt, receiveReopensAt, reopensAt]);
  return now;
};

/**
 * Bugungi qabul: holat va «hozir yopiqmi». Xato yoki backend yo'q — `supported: false`, `closed: false`
 * (funksiya ishlamasa ham buyurtma yaratish to'xtamaydi; asl to'siq — backend).
 */
export const useOrderIntake = (options?: { enabled?: boolean }) => {
  const query = useQuery({
    queryKey: ORDER_INTAKE_KEY,
    queryFn: fetchOrderIntake,
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
    // Boshqa admin o'zgartirsa — ochiq sahifalar ham bilib oladi (oyna fonda bo'lsa so'ralmaydi).
    refetchInterval: 5 * 60_000,
    meta: { silentError: true },
  });
  const state = query.data ?? UNSUPPORTED_INTAKE;
  const now = useBoundaryNow(state);
  return {
    ...state,
    closed: isOrderIntakeClosed(state, now),
    receiveClosed: isOrderReceiveClosed(state, now),
    query,
  };
};

/**
 * «Kun tartibi» (Ops) — `PATCH orders/intake-settings`: faqat o'zgargan maydonlar (`cutoff_time`,
 * `receive_cutoff_time`, `day_change_time`; `null` — cheklovni olib tashlash, kun almashishi uchun — 00:00). FAQAT
 * SUPERADMIN (boshqasiga 403), noto'g'ri soat — 400. Javob — GET bilan bir xil holat, kesh shu bilan yangilanadi.
 */
export const useUpdateOrderIntakeSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: OrderIntakeSettingsPatch) =>
      api
        .patch(API_ENDPOINTS.ORDERS.INTAKE_SETTINGS, body)
        .then((response) => normalizeOrderIntake(response.data)),
    onSuccess: (state) => queryClient.setQueryData(ORDER_INTAKE_KEY, state),
  });
};
