import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UserX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/config/store";
import { useReceivePost } from "../../../entities/mails";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import { playScanFeedback, type ScanSource, type ScanTargetListItem } from "../../../shared/lib/scanner";
import { extractScannerToken } from "../../../shared/lib/scanToken";
import { normalizeOrderDetail, type OrderDetail } from "../../new_orders/components/detail/orderDetailModel";
import {
  fetchScanDetail,
  getBackendErrorMessage,
  getScanDetailQueryKey,
  getScanResourceType,
  normalizeScanToken,
} from "../lib/scanResource";
import { getCourierReceiveDecision, readOrderPostId, readScanReceiveResult } from "./courierReceive";

/**
 * KURYER «QABUL QILISH» — universal skaner rejimi (`/scan`, 2026-11-07; andoza — BeePost `/scan` kuryer qabul sikli).
 * Maket yo'q — eng yaqini `courier-scan-active` («O'zimga olish» bilan bir xil ko'rinish: hisoblagich, ro'yxat).
 *
 * Har skan: token → buyurtma (`fetchScanDetail`, keshsiz — har safar yangi holat), keyin:
 *   - o'ziniki, yo'lda (yoki mijoz kutilmoqda) va pochtasi bor → `PATCH post/receive/:post_id { order_ids: [id],
 *     scan: true }` (faqat shu buyurtma qabul qilinadi); kamera yopilmaydi; «№… qabul qilindi» (ovoz «Qabul qilindi»),
 *     ro'yxatga qator; shu token natija keshi eskirgan deb belgilanadi;
 *   - shu sessiyada qabul qilingan token qayta o'qilsa — «takror» ovozi «№… allaqachon qabul qilindi», hech qayerga
 *     o'tilmaydi (kamerada turib qolgan kod esa 6 s jim — `useScanAssign` naqshi);
 *   - o'zidagi «kutilmoqda» (shu sessiyada qabul qilinmagan) → natija sahifasi `/scan/:token` (sotish / bekor);
 *   - bo'sh / NEW → «O'zimga olish rejimida oling»; boshqa kuryerniki yoki boshqa holat — xato ovozi va sabab.
 * Bitta token parallel ikki marta ketmaydi (yo'ldagi tokenlar to'plami).
 */

/** Kamerada turib qolgan, xato bergan kod shu vaqtdan keyin qayta tekshiriladi (`useScanAssign` bilan bir xil). */
const CAMERA_SAME_CODE_QUIET_MS = 6_000;
/** Ro'yxatda saqlanadigan oxirgi skanlar. */
const MAX_ENTRIES = 100;

type ReceivedEntry = {
  key: string;
  status: "received";
  token: string;
  orderId: string;
  ref: string;
  name: string | null;
  place: string | null;
};

type FailedEntry = {
  key: string;
  status: "failed";
  token: string;
  /** Aniqlangan buyurtma («№… · ism»); aniqlanmagan bo'lsa `null` — «Buyurtma». */
  title: string | null;
  reason: string;
  other: boolean;
};

type ReceiveEntry = ReceivedEntry | FailedEntry;

/** «№10191» — backend raqami `#`/`№` bilan kelsa ham bitta belgi. */
const orderRef = (value: string) => `№${value.replace(/^[#№]\s*/u, "")}`;

const textOf = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

const refOf = (order: OrderDetail) => orderRef(textOf(order.order_number) ?? order.id);

const courierNameOf = (order: OrderDetail) => {
  const courier = order.courier;
  return courier && typeof courier === "object" && !Array.isArray(courier)
    ? textOf((courier as { name?: unknown }).name)
    : null;
};

const placeOf = (order: OrderDetail) => {
  const district = order.district?.name;
  const region = order.region?.name;
  return textOf(district) ?? textOf(region);
};

export const useCourierReceive = ({
  enabled,
  onOpenOrder,
}: {
  enabled: boolean;
  /** O'zidagi allaqachon qabul qilingan buyurtma — natija sahifasi (sotish / bekor). */
  onOpenOrder: (token: string) => void;
}) => {
  const { t } = useTranslation("scan");
  const queryClient = useQueryClient();
  const currentUserId = useSelector((state: RootState) => state.user.user?.id ?? state.role.id ?? null);
  // Bitta qurilma — bitta navbat: tez USB skanlar serverdagi pochta qulfini navbat kutib band qilmasin.
  const { mutateAsync: receivePost } = useReceivePost({ scope: "courier-scan-receive" });
  const [entries, setEntries] = useState<ReceiveEntry[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  /**
   * Shu sessiyada qabul qilingan NOYOB buyurtmalar soni — ro'yxatdan (oxirgi `MAX_ENTRIES` tasi) emas: 100 tadan
   * ko'p skanda (yoki xatolar ko'p bo'lsa) eski qatorlar ro'yxatdan chiqadi va hisob kamayib ketardi.
   */
  const receivedOrderIdsRef = useRef(new Set<string>());
  const [received, setReceived] = useState(0);

  /** Shu sessiyada qabul qilingan tokenlar → «№…» (javob kelishi bilan — React holatini kutmasdan). */
  const receivedRef = useRef(new Map<string, string>());
  /** Yo'ldagi tokenlar — bitta token parallel ikki marta ketmasin. */
  const inflightRef = useRef(new Set<string>());
  /** Kamera oxirgi ishlagan kod va vaqti. */
  const lastCameraCodeRef = useRef<{ code: string; at: number } | null>(null);
  const mountedRef = useRef(true);
  const optionsRef = useRef({ enabled, onOpenOrder, currentUserId });

  useEffect(() => {
    optionsRef.current = { enabled, onOpenOrder, currentUserId };
  }, [currentUserId, enabled, onOpenOrder]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const addEntry = useCallback((entry: ReceiveEntry) => {
    if (!mountedRef.current) return;
    setEntries((previous) => [entry, ...previous].slice(0, MAX_ENTRIES));
  }, []);

  const fail = useCallback(
    (token: string, order: OrderDetail | null, reason: string, source: ScanSource, other = false) => {
      const ref = order ? refOf(order) : null;
      const name = order ? textOf(order.customer.name) : null;
      addEntry({
        key: `${Date.now()}-${token}-failed`,
        status: "failed",
        token,
        title: ref ? [ref, name].filter(Boolean).join(" · ") : null,
        reason,
        other,
      });
      void playScanFeedback("error", reason, source);
    },
    [addEntry],
  );

  const process = useCallback(
    async (token: string, source: ScanSource) => {
      let order: OrderDetail | null = null;
      let response: Awaited<ReturnType<typeof fetchScanDetail>>;
      try {
        // Keshsiz: qabul / sotish holati tez o'zgaradi (boshqa qurilma, menejer) — har skan yangi javob.
        response = await fetchScanDetail(token);
        order = response.type === "order" ? normalizeOrderDetail(response.data) : null;
      } catch (error) {
        if (getErrorStatus(error) === 404) {
          addEntry({
            key: `${Date.now()}-${token}-failed`,
            status: "failed",
            token,
            title: null,
            reason: t("order.notFoundTitle"),
            other: false,
          });
          void playScanFeedback("missing", t("order.notFoundTitle"), source);
          return;
        }
        fail(token, null, getBackendErrorMessage(error) ?? t("scanner.error.title"), source);
        return;
      }
      if (!order) {
        fail(token, null, t("scanner.courierReceive.notOrder"), source);
        return;
      }

      const ref = refOf(order);
      const decision = getCourierReceiveDecision(order, optionsRef.current.currentUserId);
      if (decision === "free") {
        fail(token, order, t("scanner.courierReceive.free"), source);
        return;
      }
      if (decision === "other") {
        const name = courierNameOf(order);
        fail(
          token,
          order,
          name ? t("scanner.take.otherCourier", { name }) : t("scanner.take.otherCourierUnknown"),
          source,
          true,
        );
        return;
      }
      if (decision === "notReceivable") {
        fail(token, order, t("scanner.courierReceive.notOnTheRoad"), source);
        return;
      }
      if (decision === "open") {
        // Natija sahifasi shu yangi javob bilan darhol chiziladi (qayta so'ralmaydi).
        queryClient.setQueryData(getScanDetailQueryKey(token), response);
        // Boshqa skan (qabul so'rovi) hali tugamagan — sahifadan ketilsa uning natijasi ro'yxatda ko'rinmay qoladi
        // (natija sahifasining `waitForAction` qoidasi): bu posilka keyin qayta skanerlanadi.
        if (inflightRef.current.size > 1) {
          fail(token, order, t("waitForAction"), source);
          return;
        }
        void playScanFeedback("success", t("scanner.courierReceive.openWaiting", { ref }), source, { voice: false });
        if (mountedRef.current && optionsRef.current.enabled) optionsRef.current.onOpenOrder(token);
        return;
      }

      const postId = readOrderPostId(order) as string;
      try {
        const result = readScanReceiveResult(
          await receivePost({ postId, payload: { order_ids: [order.id], scan: true } }),
          order.id,
        );
        if (!result.ok) {
          fail(token, order, result.error ?? t("scanner.courierReceive.failed", { ref }), source);
          return;
        }
        receivedRef.current.set(token, ref);
        receivedOrderIdsRef.current.add(order.id);
        if (mountedRef.current) setReceived(receivedOrderIdsRef.current.size);
        addEntry({
          key: `${Date.now()}-${token}-received`,
          status: "received",
          token,
          orderId: order.id,
          ref,
          name: textOf(order.customer.name),
          place: placeOf(order),
        });
        // Natija sahifasi (`/scan/:token`) keyingi ochilishda yangi holatni oladi.
        void queryClient.invalidateQueries({ queryKey: getScanDetailQueryKey(token), refetchType: "none" });
        void playScanFeedback("success", t("scanner.courierReceive.receivedToast", { ref }), source, {
          voice: "received",
        });
      } catch (error) {
        fail(token, order, getBackendErrorMessage(error) ?? t("scanner.courierReceive.failed", { ref }), source);
      }
    },
    [addEntry, fail, queryClient, receivePost, t],
  );

  /** Kamera, USB yoki qo'lda kiritilgan kod. */
  const handleScan = useCallback(
    (raw: string, source: ScanSource) => {
      if (!optionsRef.current.enabled) return;
      const extracted = extractScannerToken(raw, window.location.origin);
      const token = extracted ? normalizeScanToken(extracted) : null;
      if (source === "camera") {
        // Kamerada turib qolgan o'sha posilka: qabul qilingan bo'lsa — umuman, aks holda 6 s gacha jim.
        const code = token ?? raw.trim();
        const now = Date.now();
        const last = lastCameraCodeRef.current;
        if (last?.code === code && (receivedRef.current.has(code) || now - last.at < CAMERA_SAME_CODE_QUIET_MS)) return;
        lastCameraCodeRef.current = { code, at: now };
      }
      if (!token) {
        void playScanFeedback("error", t("scanner.invalid.title"), source);
        return;
      }
      if (getScanResourceType(token) !== "order") {
        void playScanFeedback("error", t("scanner.courierReceive.notOrder"), source);
        return;
      }
      const knownRef = receivedRef.current.get(token);
      if (knownRef) {
        void playScanFeedback("duplicate", t("scanner.courierReceive.alreadyToast", { ref: knownRef }), source);
        return;
      }
      if (inflightRef.current.has(token)) return;
      inflightRef.current.add(token);
      setPendingCount((count) => count + 1);
      void process(token, source).finally(() => {
        inflightRef.current.delete(token);
        if (mountedRef.current) setPendingCount((count) => Math.max(0, count - 1));
      });
    },
    [process, t],
  );

  /** Ro'yxat qatorlari (yangisi birinchi) — kamera «Ro'yxat» varag'i va yon panel. */
  const list = useMemo<ScanTargetListItem[]>(
    () =>
      entries.map((entry) => {
        if (entry.status === "failed") {
          return {
            key: entry.key,
            title: entry.title ?? t("scanner.take.orderFallback"),
            subtitle: entry.reason,
            tone: "danger",
            ...(entry.other ? { icon: UserX } : {}),
          };
        }
        return {
          key: entry.key,
          title: [entry.ref, entry.name].filter(Boolean).join(" · "),
          subtitle: [t("scanner.courierReceive.received"), entry.place].filter(Boolean).join(" · "),
          tone: "success",
        };
      }),
    [entries, t],
  );

  return { handleScan, list, received, pending: pendingCount > 0 };
};
