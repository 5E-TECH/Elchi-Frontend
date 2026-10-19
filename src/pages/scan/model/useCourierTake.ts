import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UserX } from "lucide-react";
import { useTranslation } from "react-i18next";
// Mini App oqimi (`features/tg-scan`) — modul yo'li bilan: indeks Mini App UI'sini ham olib keladi.
import { parseScanAssignResponse } from "../../../features/tg-scan/api/tgScanApi";
import type { TgScanErrorInfo } from "../../../features/tg-scan/model/scanError";
import { useScanAssign, type ScanEntry, type ScanFeedback } from "../../../features/tg-scan/model/useScanAssign";
import { playScanFeedback, type ScanSource, type ScanTargetListItem } from "../../../shared/lib/scanner";
import { extractScannerToken } from "../../../shared/lib/scanToken";
import { normalizeOrderDetail } from "../../new_orders/components/detail/orderDetailModel";
import {
  fetchScanDetail,
  getScanResourceType,
  invalidateAfterScanAction,
  normalizeScanToken,
  scanAssignOrder,
} from "../lib/scanResource";

/**
 * KURYER «O'ZIMGA OLISH» — universal skaner rejimi (`/scan`, Trello v1eLN2tV 3-bosqich; maketlar
 * `courier-scan-active`, `courier-scan-other-courier`).
 *
 * Oqim mantig'i Mini App bilan BITTA (`features/tg-scan/model/useScanAssign`): pauza/takror filtri, kamerada
 * turib qolgan kod, yo'ldagi so'rovlar, natija ro'yxati. Farqi — so'rov asosiy `api` bilan (sessiya tokeni),
 * natija ovozi va kamera xabari `playScanFeedback` orqali.
 *
 *   - har skan → `POST orders/scan-assign { qr_token }`; kamera yopilmaydi (uzluksiz);
 *   - ro'yxat: «Sizga biriktirildi», «Allaqachon sizda» (`idempotent`), «Boshqa kuryerda: <ism>» yoki xato
 *     sababi. Backend boshqa kuryer nomini aytmaydi — rad etilgach buyurtma bir marta o'qiladi
 *     (`GET orders/qr-code/:token`), ism bo'lsa qatorga yoziladi;
 *   - «Boshqa kuryerga biriktirilgan» (maket `courier-scan-other-courier`) — bitta ohang: qizil xabar, qizil
 *     `UserX` qator, xulosada «Biriktirilmadi». Buyurtma raqami va kuryer ismi aniqlangach (xabar hali
 *     ekranda bo'lsa) xabar izohi ovozsiz yangilanadi: «№10251 · Sherzod Nazarov. Menejerga xabar bering.»;
 *   - buyurtma emas (paket, pochta, market QR) — so'rovsiz rad (`scan-assign` faqat buyurtma oladi);
 *   - ovoz va tebranish faqat `playScanFeedback` (Sozlamalar «Ovoz» / «Tebranish» kalitlari bilan) — oqimning
 *     o'z tebranishi o'chiq (`haptics: false`); kamera skanlari sessiyada pauzadan o'tgan (`cameraGated`);
 *   - «Tugatish» → yo'ldagi so'rovlar kutiladi, buyurtmalar/pochta keshi yangilanadi (6qypMFeT), xulosa.
 *     Sahifa yopilsa (hook o'chsa) va oxirgi yangilanishdan keyin yangi biriktirilgan bo'lsa — kesh yana
 *     yangilanadi. Rejim almashganda hook o'chmaydi (`enabled: false`) — kesh «Tugatish» yoki chiqishda.
 */

/** Backend matni: «Order allaqachon boshqa courierga biriktirilgan» (sabab kodi ochiq emas). */
const OTHER_COURIER_PATTERN = /boshqa\s+(courier|kuryer)/i;

export const isOtherCourierError = (error: TgScanErrorInfo) =>
  error.kind === "message" && OTHER_COURIER_PATTERN.test(error.message);

/** Rad etilgan buyurtma raqami shu vaqt ichida aniqlansa — ekrandagi xabar izohi yangilanadi. */
const OTHER_COURIER_DETAIL_MS = 4_000;

/** «№10191» — backend raqami `#`/`№` bilan kelsa ham bitta belgi. */
const orderRef = (value: string) => `№${value.replace(/^[#№]\s*/u, "")}`;

export type CourierTakeSummary = { assigned: number; already: number; failed: number };

/** Xulosa sonlari: yangi biriktirilgan, avval ham sizda bo'lgan (noyob buyurtma), biriktirilmagan (noyob kod). */
export const summarizeTakeEntries = (entries: readonly ScanEntry[]): CourierTakeSummary => {
  const assigned = new Set<string>();
  const already = new Set<string>();
  const succeededTokens = new Set<string>();
  const failed = new Set<string>();
  for (const entry of entries) {
    if (entry.status === "assigned") assigned.add(entry.orderId);
    else if (entry.status === "already") already.add(entry.orderId);
    if (entry.status !== "failed") succeededTokens.add(entry.token);
  }
  for (const entry of entries) if (entry.status === "failed" && !succeededTokens.has(entry.token)) failed.add(entry.token);
  already.forEach((id) => {
    if (assigned.has(id)) already.delete(id);
  });
  return { assigned: assigned.size, already: already.size, failed: failed.size };
};

type OtherCourierInfo = { title: string | null; courier: string | null };

export const useCourierTake = ({ enabled }: { enabled: boolean }) => {
  const { t } = useTranslation("scan");
  const queryClient = useQueryClient();
  const [lookups, setLookups] = useState<Record<string, OtherCourierInfo>>({});
  const lookedUpRef = useRef(new Set<string>());
  /** Yangi biriktirilgan noyob buyurtmalar (natija kelishi bilan — React holatini kutmasdan). */
  const assignedIdsRef = useRef(new Set<string>());
  /** Kesh oxirgi yangilanganda nechta biriktirilgan edi. */
  const invalidatedCountRef = useRef(0);
  /** Oxirgi «boshqa kuryerda» xabari: buyurtma aniqlansa izohi yangilanadi (boshqa skan kelmagan bo'lsa). */
  const lastOtherRef = useRef<{ token: string; at: number } | null>(null);
  /** Aniqlangan «boshqa kuryerda» buyurtmalari (izoh uchun; holat `lookups` ning ko'zgusi). */
  const otherDetailRef = useRef(new Map<string, string>());

  const errorText = useCallback(
    (error: TgScanErrorInfo) => {
      if (isOtherCourierError(error)) return t("scanner.take.otherCourierUnknown");
      if (error.kind === "message") return error.message;
      if (error.kind === "offline") return t("scanner.take.offline");
      if (error.kind === "timeout") return t("scanner.take.timeout");
      return error.message ?? t("scanner.take.unknown");
    },
    [t],
  );

  const onFeedback = useCallback(
    (feedback: ScanFeedback) => {
      lastOtherRef.current = null;
      if (feedback.kind === "invalid") {
        void playScanFeedback("error", t("scanner.invalid.title"));
        return;
      }
      if (feedback.kind === "failed") {
        const error = feedback.entry.error;
        if (isOtherCourierError(error)) {
          const token = feedback.entry.token;
          lastOtherRef.current = { token, at: Date.now() };
          const who = otherDetailRef.current.get(token);
          void playScanFeedback("error", t("scanner.take.otherCourierUnknown"), undefined, {
            text: who ? t("scanner.take.otherCourierText", { who }) : t("scanner.take.otherCourierHint"),
          });
          return;
        }
        void playScanFeedback("error", errorText(error));
        return;
      }
      if (feedback.kind === "assigned") assignedIdsRef.current.add(feedback.entry.orderId);
      const order = feedback.entry.order;
      const ref = orderRef(order?.order_number ?? feedback.entry.orderId);
      if (feedback.kind === "assigned") {
        void playScanFeedback("success", t("scanner.take.assignedToast", { ref }));
        return;
      }
      void playScanFeedback(
        "duplicate",
        t(feedback.kind === "already" ? "scanner.take.alreadyToast" : "scanner.take.repeatToast", { ref }),
      );
    },
    [errorText, t],
  );

  const assign = useCallback(
    async (token: string) => parseScanAssignResponse(await scanAssignOrder(token)),
    [],
  );

  // 401 — asosiy `api` sessiyani o'zi yangilaydi yoki kirish sahifasiga olib ketadi; bu yerda faqat signal.
  const onSessionExpired = useCallback(() => {
    void playScanFeedback("error", t("scanner.take.unknown"));
  }, [t]);

  const flow = useScanAssign({
    webApp: null,
    enabled,
    onSessionExpired,
    assign,
    onFeedback,
    // Ovoz va tebranish — `playScanFeedback` (Sozlamalar bo'yicha); kamera pauzasi — `useScannerCameraSession`.
    haptics: false,
    cameraGated: true,
  });
  const { entries, settle } = flow;
  const handleFlowScan = flow.handleScan;

  /** Kamera, USB yoki qo'lda kiritilgan kod. Buyurtma bo'lmagan yorliq — so'rovsiz rad. */
  const handleScan = useCallback(
    (raw: string, source: ScanSource) => {
      if (!enabled) return;
      const extracted = extractScannerToken(raw, window.location.origin);
      const token = extracted ? normalizeScanToken(extracted) : null;
      if (token && getScanResourceType(token) !== "order") {
        lastOtherRef.current = null;
        void playScanFeedback("error", t("scanner.take.notOrder"), source);
        return;
      }
      handleFlowScan(token ?? raw, source === "camera" ? "camera" : "keyboard");
    },
    [enabled, handleFlowScan, t],
  );

  // «Boshqa kuryerda: <ism>» — rad etilgan buyurtma bir marta o'qiladi (ism backend xatosida yo'q).
  useEffect(() => {
    for (const entry of entries) {
      if (entry.status !== "failed" || !isOtherCourierError(entry.error) || lookedUpRef.current.has(entry.token)) continue;
      const token = entry.token;
      lookedUpRef.current.add(token);
      void fetchScanDetail(token)
        .then((response) => {
          const order = response.type === "order" ? normalizeOrderDetail(response.data) : null;
          const courier = order?.courier;
          const name =
            courier && typeof courier === "object" && !Array.isArray(courier)
              ? (courier as { name?: unknown }).name
              : null;
          const customer = order?.customer?.name?.trim();
          const info: OtherCourierInfo = {
            title: order ? [orderRef(String(order.id)), customer].filter(Boolean).join(" · ") : null,
            courier: typeof name === "string" && name.trim() ? name.trim() : null,
          };
          setLookups((previous) => ({ ...previous, [token]: info }));
          if (!order) return;
          const who = [orderRef(String(order.id)), info.courier].filter(Boolean).join(" · ");
          otherDetailRef.current.set(token, who);
          // Xabar hali ekranda (shu kod oxirgi natija) — izohga raqam va kuryer, ovozsiz.
          const last = lastOtherRef.current;
          if (last?.token === token && Date.now() - last.at < OTHER_COURIER_DETAIL_MS) {
            void playScanFeedback("error", t("scanner.take.otherCourierUnknown"), undefined, {
              text: t("scanner.take.otherCourierText", { who }),
              silent: true,
            });
          }
        })
        .catch(() => undefined);
    }
  }, [entries, t]);

  const summary = useMemo(() => summarizeTakeEntries(entries), [entries]);

  /** Ro'yxat qatorlari (yangisi birinchi) — kamera «Ro'yxat» varag'i va yon panel. */
  const list = useMemo<ScanTargetListItem[]>(
    () =>
      entries.map((entry) => {
        if (entry.status === "failed") {
          const other = isOtherCourierError(entry.error);
          const lookup = lookups[entry.token];
          return {
            key: entry.key,
            // Xom 24 belgili token kuryerga hech narsa demaydi — raqam aniqlanmaguncha «Buyurtma».
            title: lookup?.title ?? t("scanner.take.orderFallback"),
            subtitle: other
              ? lookup?.courier
                ? t("scanner.take.otherCourier", { name: lookup.courier })
                : t("scanner.take.otherCourierUnknown")
              : errorText(entry.error),
            tone: "danger",
            ...(other ? { icon: UserX } : {}),
          };
        }
        const order = entry.order;
        const ref = orderRef(order?.order_number ?? entry.orderId);
        const name = order?.customer?.name?.trim();
        const place = order?.district ?? order?.region ?? null;
        return {
          key: entry.key,
          title: [ref, name].filter(Boolean).join(" · "),
          subtitle: [t(entry.status === "assigned" ? "scanner.take.assigned" : "scanner.take.already"), place]
            .filter(Boolean)
            .join(" · "),
          tone: entry.status === "assigned" ? "success" : "neutral",
        };
      }),
    [entries, errorText, lookups, t],
  );

  /** «Tugatish»: yo'ldagi so'rovlar tugaydi (ular ham hisobga kiradi), keyin kesh yangilanadi. */
  const finish = useCallback(async () => {
    await settle();
    invalidatedCountRef.current = assignedIdsRef.current.size;
    await invalidateAfterScanAction(queryClient);
  }, [queryClient, settle]);

  // Sahifa yopildi — oxirgi yangilanishdan keyin yangi biriktirilgan bo'lsa, ro'yxatlar eskirib qolmasin.
  useEffect(
    () => () => {
      if (assignedIdsRef.current.size > invalidatedCountRef.current) void invalidateAfterScanAction(queryClient);
    },
    [queryClient],
  );

  return { handleScan, list, summary, finish, pending: flow.pendingCount > 0 };
};
