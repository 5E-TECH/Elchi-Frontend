import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import { playScanFeedback, type ScanSource } from "../../../shared/lib/scanner";
import { extractScannerToken, isForeignScanUrl } from "../../../shared/lib/scanToken";
import { useScannerGate } from "../../../shared/lib/useScannerGate";
import {
  fetchScanDetail,
  getBackendErrorMessage,
  getScanDetailQueryKey,
  getScanResourceType,
  normalizeScanToken,
  type ScanResourceType,
} from "../lib/scanResource";
import { toScanHistoryEntry, type ScanHistoryEntry } from "./scanHistory";
import { scanHistoryTitle } from "./scanHistoryText";

/** Topilgan kod: natija xabari va «Tegishli ekran ochilmoqda» ko'rinib ulgursin, keyin natija sahifasi. */
export const SCAN_OPEN_DELAY_MS = 350;

/** Skanerlangan, lekin ochilmagan kod — desktop/planshetda «Natija» kartasi (maket `courier-scan-invalid`). */
export type ScanOutcome =
  | { kind: "invalid"; raw: string; at: number }
  | { kind: "market-qr"; raw: string; at: number }
  | { kind: "not-found"; raw: string; at: number; resource: ScanResourceType }
  | { kind: "error"; raw: string; at: number; message: string | null };

/** Ochilayotgan kod: `title` — aniqlangandan keyin («№10226 · Buyurtma»), `sub` — ism / joy. */
export type ScanOpening = { token: string; title: string | null; entry: ScanHistoryEntry | null };

/** «Buyurtma / Paket / Pochta topilmadi» matni kaliti (`scan:<key>.notFoundTitle`). */
export const notFoundTextKey = (resource: ScanResourceType) =>
  resource === "package" || resource === "returned-package" ? "package" : resource === "post" ? "post" : "order";

/**
 * UNIVERSAL SKANER mantig'i (`/scan`, faqat «Ma'lumot» rejimi — 1-bosqich): bitta kod → aniqlash → natija
 * sahifasi (`/scan/:token`). Kamera, USB (HID) va qo'lda kiritish bitta `handleScan(raw, source)` ga tushadi.
 *
 *   - kamera skani kamera ichida allaqachon saralangan (700 / 1800 ms, takror jim) — bu yerda qayta
 *     saralanmaydi; USB'da pauza yo'q, faqat bir xil kod takrori «takror» ovozi bilan ushlanadi;
 *   - kod aniqlanguncha (`fetchQuery`, javob keshga tushadi — natija sahifasi darhol chiziladi) keyingi skan
 *     «Oldingi kod ochilmoqda» bilan rad etiladi (jim yo'qolmaydi);
 *   - topildi → «№… topildi» + `SCAN_OPEN_DELAY_MS` dan keyin natija sahifasi;
 *   - topilmadi / yaroqsiz QR / market QR / xato → skaner ochiq qoladi (uzluksiz), natija kamerada va
 *     desktopda «Natija» kartasida; market QR (`MCR-`) hech qachon so'ralmaydi (bir martalik, backend yeydi).
 */
export const useUniversalScan = () => {
  const { t, i18n } = useTranslation("scan");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { evaluateScan } = useScannerGate({ cooldownMs: 0, duplicateCooldownMs: 1800 });
  const openingRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const [opening, setOpening] = useState<ScanOpening | null>(null);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const handleScan = useCallback(
    async (raw: string, source: ScanSource) => {
      // Begona sayt havolasi (Elchi yorlig'i emas) — so'rovsiz «yaroqsiz»: oxirgi bo'lagi token emas.
      const foreign = isForeignScanUrl(raw, window.location.origin);
      const extracted = foreign ? null : extractScannerToken(raw, window.location.origin);
      const token = extracted ? normalizeScanToken(extracted) : null;

      if (openingRef.current) {
        if (token !== openingRef.current) void playScanFeedback("error", t("scanner.previousOpening"), source);
        return;
      }

      // HID skaneri: pauza yo'q, faqat ataylab qilingan takror signal bilan bildiriladi.
      if (source === "keyboard" && evaluateScan(raw, { ignoreCooldown: true }) === "duplicate") {
        void playScanFeedback("duplicate", undefined, source);
        return;
      }

      const at = Date.now();
      if (!token) {
        setOutcome({ kind: "invalid", raw, at });
        void playScanFeedback("error", t("scanner.invalid.title"), source);
        return;
      }

      const resource = getScanResourceType(token);
      if (resource === "market-qr") {
        setOutcome({ kind: "market-qr", raw: token, at });
        void playScanFeedback("error", t("scanner.marketQr.title"), source);
        return;
      }

      openingRef.current = token;
      setOutcome(null);
      setOpening({ token, title: null, entry: null });
      try {
        const response = await queryClient.fetchQuery({
          queryKey: getScanDetailQueryKey(token),
          queryFn: () => fetchScanDetail(token),
          retry: false,
          meta: { silentError: true },
        });
        const entry = toScanHistoryEntry(token, response, at);
        if (!entry) {
          openingRef.current = null;
          setOpening(null);
          setOutcome({ kind: "not-found", raw: token, at, resource });
          void playScanFeedback("missing", t(`${notFoundTextKey(resource)}.notFoundTitle`), source);
          return;
        }
        const title = scanHistoryTitle(t, entry, language);
        setOpening({ token, title, entry });
        void playScanFeedback("success", t("scanner.found", { title }), source);
        timerRef.current = window.setTimeout(() => {
          navigate(`/scan/${encodeURIComponent(token)}`);
        }, SCAN_OPEN_DELAY_MS);
      } catch (error) {
        openingRef.current = null;
        setOpening(null);
        if (getErrorStatus(error) === 404) {
          setOutcome({ kind: "not-found", raw: token, at, resource });
          void playScanFeedback("missing", t(`${notFoundTextKey(resource)}.notFoundTitle`), source);
          return;
        }
        const message = getBackendErrorMessage(error) ?? null;
        setOutcome({ kind: "error", raw: token, at, message });
        void playScanFeedback("error", message ?? t("scanner.error.title"), source);
      }
    },
    [evaluateScan, language, navigate, queryClient, t],
  );

  return { handleScan, opening, outcome };
};
