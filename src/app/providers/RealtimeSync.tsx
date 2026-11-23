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
import { notify, toastStore } from "../../shared/lib/notify";
import { logRealtime, realtimeUrl, setRealtimeConnected } from "../../shared/lib/realtime";
import {
  handleSessionRevokedEvent,
  handleSessionRevokedSocketError,
  isSessionCheckUnavailableSocketError,
  SESSION_REVOKED_EVENT,
} from "../../auth/sessionRevoked";

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
 *   Bu xabar ochiq turganda kelgan keyingi partiyalar (bitta qator ham) uning soniga QO'SHILADI — xabar u chiqqandan
 *   beri kelgan jami yangi bildirishnomalarni ko'rsatadi (3 + 2 → «5 ta», G6F68ti6 17-band); xabar yopilsa sanoq
 *   boshidan.
 * - Har ulanishda (birinchi ham) inbox yangilanadi — ulanmagan oraliqdagi xabarlar yo'qolmaydi.
 * - Polling zaxira: ulanganda sanoq 5 daqiqada, uzilganda 60 s da (`useUnreadCount`).
 * - Buyurtma hodisasi (`category: "order"`, qatorli yoki signal) — ochiq buyurtma so'rovlari (`["orders"]`: ro'yxat,
 *   holat tablari sonlari va «Qabul va yaratish» badge'i — GaBIPi3Z) shu yig'ish oynasida bir marta yangilanadi.
 * - AI maslahatchining jiddiy ogohlantirishi (`type: "ai.advisor_alert"`, 60PWUbgC; maket `tizim-ai-advisor-messages`
 *   «Jiddiy ogohlantirish · ilova ochiq»): qatorli yoki signal — `overview` va ogohlantirishlar ro'yxatlari shu
 *   oynada bir marta yangilanadi; qatorli hodisa — umumiy «N ta yangi»ga qo'shilmaydi, foydalanuvchi yopguncha
 *   turadigan xabar (`duration: 0`, kalit o'sha `elchi-push-<id>`, «Ochish» → ogohlantirish oynasi); bir oynada bir
 *   nechtasi — bitta «N ta jiddiy ogohlantirish» («Ochish» → faqat jiddiylar ro'yxati). Yashirin
 *   tabda ham chiqadi — u o'zi yopilmaydi, foydalanuvchi qaytganda ko'radi (bu tur uchun push yo'q). Matn va
 *   yangilash — `realtimeAdvisor` (socket bilan birga dinamik). Ogohlantirish o'zgarishi (`ai.advisor.alert_changed`:
 *   ochilish, takror, «Ko'rildi», yopilish, AI izohi tayyor) — inbox'ga tegmaydi: shu oynada yig'ilib, `overview`,
 *   ro'yxatlar va ochiq tafsilot (GET'ning o'z «Ko'rildi»sidan tashqari) bir marta qayta o'qiladi.
 * - Sessiya boshqa qurilmadan yopilsa (Elchi Pochta #3): `auth:session_revoked` `{ session_id, reason }` — joriy
 *   token `sid` iga mos bo'lsa — yoki yopilgan sessiya tokeni bilan ulanish rad etilsa (`error` / `connect_error`
 *   «SESSION_REVOKED») — qurilma joyida chiqadi (`auth/sessionRevoked` → `logoutRevokedSession`, `POST auth/logout`
 *   siz). Socket shu zahoti tinglovchilarsiz uziladi va qayta ulanmaydi (server keyin «io server disconnect» qilsa
 *   ham); boshqa uzilishlar avvalgidek.
 */

type RealtimePayload = Partial<
  Pick<InboxNotification, "id" | "title" | "body" | "link" | "category" | "type" | "data">
>;

/** AI maslahatchi hodisalari moduli — socket.io bilan birga dinamik yuklanadi (ilova kirish bo'lagiga kirmaydi). */
type AdvisorModule = typeof import("./realtimeAdvisor");

/** Buyurtma so'rovlari kalit prefiksi (`entities/order` `ORDER_KEY`, holat sonlari ham shu ostida). */
const ORDERS_QUERY_PREFIX = "orders";

/** Bir vaqtda kelgan hodisalarni yig'ish oynasi — bitta so'rov va bitta xabar. */
const BATCH_MS = 400;

/**
 * Buyurtma hodisasidan keyin ochiq ro'yxatlarni yangilash — ko'pi bilan shu oraliqda BIR marta (skan auditi #106).
 * HQ skanerlab qabul qilganda har skan market va logist qurilmalariga hodisa yuboradi; ilgari har biri (400 ms
 * yig'ishdan keyin) butun `orders` so'rovlarini qayta yuklardi — 1 skan/s da market ekrani to'xtovsiz yuklanardi.
 */
export const REALTIME_ORDERS_REFRESH_MS = 3_000;

/** «N ta yangi bildirishnoma» xabarining kaliti — ochiq bo'lsa yangi partiya shu xabarga qo'shiladi. */
const BATCH_TOAST_ID = "elchi-realtime-batch";

const isBatchToastOpen = () =>
  toastStore.getSnapshot().some((toast) => toast.id === BATCH_TOAST_ID && !toast.closing);

/**
 * NDmZMzCP: ulanish `SESSION_CHECK_UNAVAILABLE` bilan rad etilsa (identity vaqtincha javob bermadi) — chiqish emas,
 * shuncha kutib (+ tasodifiy 0–5 s, hamma qurilma bir soniyada urinmasin) qayta ulanadi.
 */
const SESSION_CHECK_RECONNECT_MS = 15_000;
const SESSION_CHECK_RECONNECT_JITTER_MS = 5_000;

/** Faqat ilova ichidagi yo'l — tashqi havola toastdan ochilmaydi. */
const toInAppLink = (link: string | null | undefined) =>
  typeof link === "string" && link.startsWith("/") && !link.startsWith("//") ? link : "/inbox";

const RealtimeSync = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("notifications");
  const accessToken = useSelector((state: RootState) => state.user.accessToken);
  const isAuthenticated = useSelector((state: RootState) => state.user.isAuthenticated);

  // Bir vaqtda kelgan hodisalar (masalan bitta buyurtmaning ketma-ket holatlari) BATCH_MS ichida yig'iladi:
  // bitta yangilash so'rovi va bitta xabar (bir nechta bo'lsa — «N ta yangi bildirishnoma»).
  const pendingRef = useRef(new Map<string, RealtimePayload>());
  /** Yig'ish oynasida buyurtma hodisasi keldimi — ro'yxat va sonlar (`["orders"]`) bir marta yangilanadi. */
  const ordersChangedRef = useRef(false);
  /** Yig'ish oynasida AI maslahatchi ogohlantirishi keldimi — `overview` va ro'yxatlar bir marta yangilanadi. */
  const advisorChangedRef = useRef(false);
  /** `realtimeAdvisor` — socket ulanishidan oldin yuklanadi, shuning uchun hodisa kelganda tayyor. */
  const advisorRef = useRef<AdvisorModule | null>(null);
  /** `ai.advisor.alert_changed` yig'ish oynasi: tafsiloti qayta o'qiladigan ogohlantirishlar va taymer. */
  const advisorChangeIdsRef = useRef(new Set<string>());
  const advisorChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ordersRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ordersRefreshPendingRef = useRef(false);
  /**
   * Ochiq «N ta yangi bildirishnoma» xabarida sanalgan qatorlar (`id`): keyingi partiya shu songa qo'shiladi, bir xil
   * `id` ikki marta sanalmaydi. Xabar yopilgan (yoki yopilayotgan) bo'lsa — keyingi partiyada boshidan.
   */
  const batchIdsRef = useRef(new Set<string>());

  // Ishlovchi — eng so'nggi `t` / `navigate` bilan; ulanish ular o'zgarganda qayta ochilmaydi.
  const flushRef = useRef<() => void>(() => {});
  useEffect(() => {
    flushRef.current = () => {
      flushTimerRef.current = null;
      const rows = [...pendingRef.current.values()];
      pendingRef.current.clear();
      void queryClient.invalidateQueries({ queryKey: queryKeys.notificationsInbox.all });
      if (ordersChangedRef.current) {
        ordersChangedRef.current = false;
        const refreshOrders = () =>
          void queryClient.invalidateQueries({ queryKey: [ORDERS_QUERY_PREFIX], refetchType: "active" });
        if (ordersRefreshTimerRef.current) {
          // Oraliq ichida — oxirida bitta yangilash (uzluksiz skanda ham har oraliqda bir marta).
          ordersRefreshPendingRef.current = true;
        } else {
          // Birinchi hodisa — darhol (avvalgidek); keyingilari shu oraliqda yig'iladi.
          refreshOrders();
          const closeWindow = () => {
            ordersRefreshTimerRef.current = null;
            if (!ordersRefreshPendingRef.current) return;
            ordersRefreshPendingRef.current = false;
            refreshOrders();
            ordersRefreshTimerRef.current = setTimeout(closeWindow, REALTIME_ORDERS_REFRESH_MS);
          };
          ordersRefreshTimerRef.current = setTimeout(closeWindow, REALTIME_ORDERS_REFRESH_MS);
        }
      }
      const advisor = advisorRef.current;
      if (advisorChangedRef.current) {
        advisorChangedRef.current = false;
        if (advisor) void advisor.refreshAdvisorQueries(queryClient);
      }
      // Jiddiy AI ogohlantirishi — yopilguncha (yashirin tabda ham: o'zi yopilmaydi); bitta — o'zi, bir nechta —
      // bitta umumiy xabar (yopilmaydigan xabarlar `MAX_TOASTS` dan oshib, eskilari jimgina tushib qolmasin).
      let others = rows;
      if (advisor) {
        others = rows.filter((row) => !advisor.isAdvisorAlert(row));
        const alerts = rows.filter((row) => advisor.isAdvisorAlert(row));
        const show = (id: string, toast: { title: string; description?: string; link: string | null }) => {
          const link = toInAppLink(toast.link);
          notify.error(toast.title, {
            id,
            description: toast.description,
            duration: 0,
            action: { label: t("push.toastOpen"), onClick: () => navigate(link) },
          });
        };
        if (alerts.length > 1) {
          const language = i18n.resolvedLanguage ?? i18n.language;
          show(`elchi-advisor-batch-${alerts[0].id}`, advisor.advisorAlertsBatchToast(alerts, t, language));
        } else if (alerts.length === 1) {
          show(`elchi-push-${alerts[0].id}`, advisor.advisorAlertToast(alerts[0], t));
        }
      }
      // Yashirin tabda xabar emas (badge baribir yangilanadi).
      if (!others.length || document.visibilityState !== "visible") return;
      const counted = batchIdsRef.current;
      if (!isBatchToastOpen()) counted.clear();
      // Bir nechta qator yoki «N ta» xabari hali ochiq (bitta qator ham unga qo'shiladi) — jami son bitta xabarda.
      if (others.length > 1 || counted.size > 0) {
        for (const row of others) counted.add(row.id as string);
        notify.info(t("realtime.manyNew", { count: counted.size }), {
          id: BATCH_TOAST_ID,
          action: { label: t("push.toastOpen"), onClick: () => navigate("/inbox") },
        });
        return;
      }
      const [row] = others;
      const category = row.category ? t(`category.${row.category}`) : null;
      const description = [category, row.body?.trim()].filter(Boolean).join(" · ") || undefined;
      const link = toInAppLink(row.link);
      notify.info(row.title as string, {
        id: `elchi-push-${row.id}`,
        description,
        action: { label: t("push.toastOpen"), onClick: () => navigate(link) },
      });
    };
  }, [i18n, navigate, queryClient, t]);

  // rWdLuoP3: smena va kassa kartasi hodisasi — ochiq kassa sahifalari yangilanadi; avtomatik yopilganda xabar.
  // Ishlovchi modul socket bilan birga dinamik yuklanadi (`realtimeFinance`) — eng so'nggi `t` ref orqali.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const handleNotification = useRef((payload: RealtimePayload) => {
    // Rol/broadcast signali (`id` yo'q) — faqat yangilash; qatorli hodisa — xabar uchun (bir xil `id` bir marta).
    if (payload.id && payload.title) pendingRef.current.set(payload.id, payload);
    if (payload.category === "order") ordersChangedRef.current = true;
    if (advisorRef.current?.isAdvisorAlert(payload)) advisorChangedRef.current = true;
    if (!flushTimerRef.current)
      flushTimerRef.current = setTimeout(() => flushRef.current(), BATCH_MS);
  }).current;

  // Ogohlantirish o'zgarishi — tekshiruvda bir nechtasi birga keladi: `BATCH_MS` ichida bitta yangilash; inbox emas.
  const handleAdvisorChanged = useRef((payload: unknown) => {
    const advisor = advisorRef.current;
    const change = advisor?.readAdvisorAlertChange(payload);
    if (!advisor || !change) return;
    if (change.refetchDetail) advisorChangeIdsRef.current.add(change.alertId);
    if (advisorChangeTimerRef.current) return;
    advisorChangeTimerRef.current = setTimeout(() => {
      advisorChangeTimerRef.current = null;
      const ids = [...advisorChangeIdsRef.current];
      advisorChangeIdsRef.current.clear();
      void advisor.refreshAdvisorQueries(queryClient, ids);
    }, BATCH_MS);
  }).current;

  useEffect(
    () => () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      if (ordersRefreshTimerRef.current) {
        clearTimeout(ordersRefreshTimerRef.current);
        ordersRefreshTimerRef.current = null;
      }
      if (advisorChangeTimerRef.current) clearTimeout(advisorChangeTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;
    let socket: Socket | null = null;
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    // Kutubxona faqat kirgandan keyin yuklanadi — kirish sahifasi va birinchi yuklanish og'irlashmaydi.
    // Token `auth` da ketadi (cookie kerak emas — `withCredentials` yo'q).
    void Promise.all([import("socket.io-client"), import("./realtimeFinance"), import("./realtimeAdvisor")])
      .then(([{ io }, finance, advisor]) => {
        if (cancelled) return;
        advisorRef.current = advisor;
        // WebSocket birinchi (kam so'rov, Cloudflare qo'llaydi); to'silgan tarmoqda polling'ga o'tadi.
        const client = io(realtimeUrl(BASE_URL), {
          auth: { token: accessToken },
          transports: ["websocket", "polling"],
          tryAllTransports: true,
        });
        socket = client;
        // Shu socketning sessiyasi yopildi — kanal shu zahoti yopiladi (chiqish — `auth/sessionRevoked`):
        // tinglovchilarsiz (keyingi «io server disconnect» yopilgan token bilan sanoq so'rovini yubormaydi) va
        // qayta urinishsiz (`disconnect()` — socket.io qayta ulanmaydi).
        const closeRevoked = () => {
          setRealtimeConnected(false);
          logRealtime("sessiya yopildi — kanal yopiladi");
          client.removeAllListeners();
          client.disconnect();
        };
        // Sessiya tekshiruvi vaqtincha ishlamadi — server rad etib uzadi (socket.io o'zi qayta urinmaydi): kechiktirib
        // qo'lda ulanish. Bir vaqtda faqat bitta taymer.
        let sessionCheckFailed = false;
        const reconnectLater = () => {
          if (reconnectTimer || cancelled) return;
          logRealtime("sessiyani tekshirib bo'lmadi — keyinroq qayta ulanadi");
          reconnectTimer = setTimeout(
            () => {
              reconnectTimer = null;
              if (!cancelled && !client.connected) client.connect();
            },
            SESSION_CHECK_RECONNECT_MS + Math.floor(Math.random() * SESSION_CHECK_RECONNECT_JITTER_MS),
          );
        };
        client.on(SESSION_REVOKED_EVENT, (payload: unknown) => {
          if (handleSessionRevokedEvent(payload)) closeRevoked();
          else logRealtime("boshqa sessiya hodisasi — e'tiborsiz", payload);
        });
        client.on("connect", () => {
          setRealtimeConnected(true);
          logRealtime("ulandi");
          // Har ulanishda (birinchi, token yangilangach, tarmoq qaytgach): ulanmagan oraliqda kelgan xabarlar ro'yxat
          // va badge'ga tushsin; so'rov yangilangach polling oralig'i ham darhol 5 daqiqaga o'tadi.
          void queryClient.invalidateQueries({ queryKey: queryKeys.notificationsInbox.all });
        });
        client.on("connected", (info: unknown) => logRealtime("server tasdiqladi", info));
        client.on("disconnect", (reason) => {
          setRealtimeConnected(false);
          logRealtime("uzildi", reason);
          if (reason === "io server disconnect" && sessionCheckFailed) {
            sessionCheckFailed = false;
            reconnectLater();
          }
          // Uzilish oralig'ida kelgan xabarlar o'tib ketmasin — sanoq darhol so'raladi, keyin 60 s polling.
          void queryClient.invalidateQueries({
            queryKey: queryKeys.notificationsInbox.unreadCount,
          });
        });
        client.on("connect_error", (error) => {
          setRealtimeConnected(false);
          logRealtime(
            client.active ? "ulanib bo'lmadi, qayta urinadi" : "ulanish rad etildi",
            error.message,
          );
          // Yopilgan sessiya tokeni bilan qayta ulanish rad etildi — qayta urinish emas, chiqish.
          if (handleSessionRevokedSocketError(error)) closeRevoked();
          else if (!client.active && isSessionCheckUnavailableSocketError(error)) reconnectLater();
        });
        client.on("error", (error: unknown) => {
          logRealtime("server xatosi", error);
          if (handleSessionRevokedSocketError(error)) closeRevoked();
          else if (isSessionCheckUnavailableSocketError(error)) sessionCheckFailed = true;
        });
        client.on("notification:new", (payload: RealtimePayload) =>
          handleNotification(payload ?? {}),
        );
        client.on(advisor.ADVISOR_CHANGED_EVENT, (payload: unknown) => handleAdvisorChanged(payload));
        for (const event of finance.FINANCE_EVENTS) {
          client.on(event, (payload: unknown) => finance.handleFinanceEvent(queryClient, tRef.current, event, payload));
        }
      })
      // Bo'lak yuklanmasa (tarmoq, eski deploy) — jonli kanal o'chiq qoladi, 60 s polling ishlayveradi.
      .catch((error: unknown) => logRealtime("kutubxona yuklanmadi", error));

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }
      setRealtimeConnected(false);
    };
  }, [accessToken, handleAdvisorChanged, handleNotification, isAuthenticated, queryClient]);

  return null;
};

export default RealtimeSync;
