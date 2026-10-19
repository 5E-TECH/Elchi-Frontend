import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
 *   - buyurtma emas (paket, pochta, market QR) — so'rovsiz rad (`scan-assign` faqat buyurtma oladi);
 *   - «Tugatish» → yo'ldagi so'rovlar kutiladi, buyurtmalar/pochta keshi yangilanadi (6qypMFeT), xulosa.
 *     Rejimdan chiqilsa yoki sahifa yopilsa ham, biriktirilgan bo'lsa — kesh yangilanadi.
 */

/** Backend matni: «Order allaqachon boshqa courierga biriktirilgan» (sabab kodi ochiq emas). */
const OTHER_COURIER_PATTERN = /boshqa\s+(courier|kuryer)/i;

export const isOtherCourierError = (error: TgScanErrorInfo) =>
  error.kind === "message" && OTHER_COURIER_PATTERN.test(error.message);

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
  const invalidatedCountRef = useRef(0);

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
      if (feedback.kind === "invalid") {
        void playScanFeedback("error", t("scanner.invalid.title"));
        return;
      }
      if (feedback.kind === "failed") {
        const error = feedback.entry.error;
        void playScanFeedback(
          "error",
          isOtherCourierError(error) ? t("scanner.take.otherCourierToast") : errorText(error),
        );
        return;
      }
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

  const flow = useScanAssign({ webApp: null, enabled, onSessionExpired, assign, onFeedback });
  const { entries, settle } = flow;
  const handleFlowScan = flow.handleScan;

  /** Kamera, USB yoki qo'lda kiritilgan kod. Buyurtma bo'lmagan yorliq — so'rovsiz rad. */
  const handleScan = useCallback(
    (raw: string, source: ScanSource) => {
      if (!enabled) return;
      const extracted = extractScannerToken(raw, window.location.origin);
      const token = extracted ? normalizeScanToken(extracted) : null;
      if (token && getScanResourceType(token) !== "order") {
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
          setLookups((previous) => ({
            ...previous,
            [token]: {
              title: order ? [orderRef(String(order.id)), customer].filter(Boolean).join(" · ") : null,
              courier: typeof name === "string" && name.trim() ? name.trim() : null,
            },
          }));
        })
        .catch(() => undefined);
    }
  }, [entries]);

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
            title: lookup?.title ?? entry.token,
            subtitle: other
              ? lookup?.courier
                ? t("scanner.take.otherCourier", { name: lookup.courier })
                : t("scanner.take.otherCourierUnknown")
              : errorText(entry.error),
            tone: other ? "warning" : "danger",
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

  const invalidate = useCallback(() => {
    invalidatedCountRef.current = summary.assigned;
    return invalidateAfterScanAction(queryClient);
  }, [queryClient, summary.assigned]);

  /** «Tugatish»: yo'ldagi so'rovlar tugaydi, kesh yangilanadi; xulosa sonlari qaytadi. */
  const finish = useCallback(async () => {
    await settle();
    await invalidate();
  }, [invalidate, settle]);

  // Rejimdan chiqildi yoki sahifa yopildi — yangi biriktirilgan bo'lsa, ro'yxatlar eskirib qolmasin.
  const assignedRef = useRef(summary.assigned);
  useEffect(() => {
    assignedRef.current = summary.assigned;
  }, [summary.assigned]);
  useEffect(
    () => () => {
      if (assignedRef.current > invalidatedCountRef.current) void invalidateAfterScanAction(queryClient);
    },
    [queryClient],
  );

  return { handleScan, list, summary, finish, pending: flow.pendingCount > 0 };
};
