import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import {
  isIntakeUnsupportedError,
  isOrderIntakeClosed,
  normalizeOrderIntake,
  UNSUPPORTED_INTAKE,
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
 * Keyingi chegara (`closes_at` / `reopens_at`) kelganda qayta chiziladi: 10:00 da yaratish sahifasi so'rovsiz
 * yopiladi, kun almashganda holat qayta so'raladi.
 */
const useBoundaryNow = (closesAt: string | null, reopensAt: string | null) => {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const reopens = reopensAt ? Date.parse(reopensAt) : null;
    if (reopens !== null && now >= reopens)
      void queryClient.invalidateQueries({ queryKey: ORDER_INTAKE_KEY });
    const upcoming = [closesAt, reopensAt]
      .map((value) => (value ? Date.parse(value) : Number.NaN))
      .filter((time) => Number.isFinite(time) && time > now);
    if (upcoming.length === 0) return undefined;
    // `setTimeout` chegarasi ~24,8 kun — undan uzoq bo'lsa keyinroq qayta hisoblanadi.
    const delay = Math.min(Math.min(...upcoming) - now + 250, 2_147_000_000);
    const timer = window.setTimeout(() => setNow(Date.now()), delay);
    return () => window.clearTimeout(timer);
  }, [closesAt, now, queryClient, reopensAt]);
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
  const now = useBoundaryNow(state.closesAt, state.reopensAt);
  return { ...state, closed: isOrderIntakeClosed(state, now), query };
};

/** `PATCH orders/intake-settings` — `null` cheklovni olib tashlaydi (FAQAT SUPERADMIN, admin — 403). */
export const useUpdateOrderIntake = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cutoffTime: string | null) =>
      api
        .patch(API_ENDPOINTS.ORDERS.INTAKE_SETTINGS, { cutoff_time: cutoffTime })
        .then((response) => normalizeOrderIntake(response.data)),
    onSuccess: (state) => queryClient.setQueryData(ORDER_INTAKE_KEY, state),
  });
};
