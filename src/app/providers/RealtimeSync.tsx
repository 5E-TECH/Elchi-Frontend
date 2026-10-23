import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import type { Socket } from "socket.io-client";
import type { RootState } from "../config/store";
import type { InboxNotification } from "../../entities/notification-inbox/model/types";
import { queryKeys } from "../../shared/config/queryKeys";
import { BASE_URL } from "../../shared/const";
import { notify } from "../../shared/lib/notify";
import { logRealtime, realtimeUrl, setRealtimeConnected } from "../../shared/lib/realtime";

/**
 * RealtimeSync (uRkw6lk0) — bildirishnomalar 60 s kutmasdan, darhol ko'rinsin.
 *
 * Kontrakt (FRONTEND_CHANGELOG 2026-10-14, m9BOlEbE): socket.io namespace `/realtime` (API hosti),
 * `io(`${API}/realtime`, { auth: { token } })`; ulanishda `connected`, token yo'q/soxta → `error` va server uzadi.
 * Hodisa `notification:new`: aniq qabul qiluvchiga — to'liq inbox qatori (`id`, `title`, `body`, `link` …);
 * rol/broadcast dispatch'da — `id` siz signal `{ type, category, priority }`.
 *
 * - Kirgan foydalanuvchi uchun ulanadi; logout'da uziladi va qayta urinmaydi; access token yangilansa — yangi
 *   token bilan qayta ulanadi. Server rad etsa (`io server disconnect`) socket.io o'zi qayta ulanmaydi —
 *   cheksiz sikl yo'q; tarmoq uzilsa — o'zi (oraliq bilan) qayta ulanadi.
 * - Hodisalar 400 ms ichida yig'iladi: inbox, sanoq va badge bitta so'rov bilan yangilanadi
 *   (`notificationsInbox.all`); ko'rinib turgan tabda bitta qator — `notify.info` (kaliti push'dagi bilan bir xil,
 *   `elchi-push-<id>` — push va socket orqali kelsa ham ikki marta chiqmaydi), bir nechta — «N ta yangi bildirishnoma».
 * - Har ulanishda (birinchi ham) inbox yangilanadi — ulanmagan oraliqdagi xabarlar yo'qolmaydi.
 * - Polling zaxira: ulanganda sanoq 5 daqiqada, uzilganda 60 s da (`useUnreadCount`).
 */

type RealtimePayload = Partial<
  Pick<InboxNotification, "id" | "title" | "body" | "link" | "category" | "type">
>;

/** Bir vaqtda kelgan hodisalarni yig'ish oynasi — bitta so'rov va bitta xabar. */
const BATCH_MS = 400;

/** Faqat ilova ichidagi yo'l — tashqi havola toastdan ochilmaydi. */
const toInAppLink = (link: string | null | undefined) =>
  typeof link === "string" && link.startsWith("/") && !link.startsWith("//") ? link : "/inbox";

const RealtimeSync = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useTranslation("notifications");
  const accessToken = useSelector((state: RootState) => state.user.accessToken);
  const isAuthenticated = useSelector((state: RootState) => state.user.isAuthenticated);

  // Bir vaqtda kelgan hodisalar (masalan bitta buyurtmaning ketma-ket holatlari) BATCH_MS ichida yig'iladi:
  // bitta yangilash so'rovi va bitta xabar (bir nechta bo'lsa — «N ta yangi bildirishnoma»).
  const pendingRef = useRef(new Map<string, RealtimePayload>());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ishlovchi — eng so'nggi `t` / `navigate` bilan; ulanish ular o'zgarganda qayta ochilmaydi.
  const flushRef = useRef<() => void>(() => {});
  useEffect(() => {
    flushRef.current = () => {
      flushTimerRef.current = null;
      const rows = [...pendingRef.current.values()];
      pendingRef.current.clear();
      void queryClient.invalidateQueries({ queryKey: queryKeys.notificationsInbox.all });
      // Yashirin tabda xabar emas (badge baribir yangilanadi).
      if (!rows.length || document.visibilityState !== "visible") return;
      if (rows.length > 1) {
        notify.info(t("realtime.manyNew", { count: rows.length }), {
          id: "elchi-realtime-batch",
          action: { label: t("push.toastOpen"), onClick: () => navigate("/inbox") },
        });
        return;
      }
      const [row] = rows;
      const category = row.category ? t(`category.${row.category}`) : null;
      const description = [category, row.body?.trim()].filter(Boolean).join(" · ") || undefined;
      const link = toInAppLink(row.link);
      notify.info(row.title as string, {
        id: `elchi-push-${row.id}`,
        description,
        action: { label: t("push.toastOpen"), onClick: () => navigate(link) },
      });
    };
  }, [navigate, queryClient, t]);

  // rWdLuoP3: smena hodisasi — ochiq kassa sahifalari yangilanadi; avtomatik yopilganda kassirga xabar.
  // Ishlovchi modul socket bilan birga dinamik yuklanadi (`realtimeFinance`) — eng so'nggi `t` ref orqali.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const handleNotification = useRef((payload: RealtimePayload) => {
    // Rol/broadcast signali (`id` yo'q) — faqat yangilash; qatorli hodisa — xabar uchun (bir xil `id` bir marta).
    if (payload.id && payload.title) pendingRef.current.set(payload.id, payload);
    if (!flushTimerRef.current)
      flushTimerRef.current = setTimeout(() => flushRef.current(), BATCH_MS);
  }).current;

  useEffect(
    () => () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;
    let socket: Socket | null = null;
    let cancelled = false;

    // Kutubxona faqat kirgandan keyin yuklanadi — kirish sahifasi va birinchi yuklanish og'irlashmaydi.
    // Token `auth` da ketadi (cookie kerak emas — `withCredentials` yo'q).
    void Promise.all([import("socket.io-client"), import("./realtimeFinance")])
      .then(([{ io }, finance]) => {
        if (cancelled) return;
        // WebSocket birinchi (kam so'rov, Cloudflare qo'llaydi); to'silgan tarmoqda polling'ga o'tadi.
        socket = io(realtimeUrl(BASE_URL), {
          auth: { token: accessToken },
          transports: ["websocket", "polling"],
          tryAllTransports: true,
        });
        socket.on("connect", () => {
          setRealtimeConnected(true);
          logRealtime("ulandi");
          // Har ulanishda (birinchi, token yangilangach, tarmoq qaytgach): ulanmagan oraliqda kelgan xabarlar ro'yxat
          // va badge'ga tushsin; so'rov yangilangach polling oralig'i ham darhol 5 daqiqaga o'tadi.
          void queryClient.invalidateQueries({ queryKey: queryKeys.notificationsInbox.all });
        });
        socket.on("connected", (info: unknown) => logRealtime("server tasdiqladi", info));
        socket.on("disconnect", (reason) => {
          setRealtimeConnected(false);
          logRealtime("uzildi", reason);
          // Uzilish oralig'ida kelgan xabarlar o'tib ketmasin — sanoq darhol so'raladi, keyin 60 s polling.
          void queryClient.invalidateQueries({
            queryKey: queryKeys.notificationsInbox.unreadCount,
          });
        });
        socket.on("connect_error", (error) => {
          setRealtimeConnected(false);
          logRealtime(
            socket?.active ? "ulanib bo'lmadi, qayta urinadi" : "ulanish rad etildi",
            error.message,
          );
        });
        socket.on("error", (error: unknown) => logRealtime("server xatosi", error));
        socket.on("notification:new", (payload: RealtimePayload) =>
          handleNotification(payload ?? {}),
        );
        for (const event of finance.FINANCE_SHIFT_EVENTS) {
          socket.on(event, (payload: unknown) => finance.handleShiftEvent(queryClient, tRef.current, event, payload));
        }
      })
      // Bo'lak yuklanmasa (tarmoq, eski deploy) — jonli kanal o'chiq qoladi, 60 s polling ishlayveradi.
      .catch((error: unknown) => logRealtime("kutubxona yuklanmadi", error));

    return () => {
      cancelled = true;
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }
      setRealtimeConnected(false);
    };
  }, [accessToken, handleNotification, isAuthenticated, queryClient]);

  return null;
};

export default RealtimeSync;
