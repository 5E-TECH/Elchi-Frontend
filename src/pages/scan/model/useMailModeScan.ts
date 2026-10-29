import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
} from "../lib/scanResource";
import { isMailReadyFor, readScannedMail, type ScanMailKind, type ScannedMail } from "./scanPickers";
import { SCAN_OPEN_DELAY_MS } from "./useUniversalScan";

/** Ochilayotgan pochta: `title` — aniqlangandan keyin («Pochta №2486»). */
export type MailModeOpening = { token: string; title: string | null };

/**
 * «Pochtani jo'natish» va «Rad etilgan pochta» rejimlarida pochta QR'i (Trello vNcGDnNh 2-band): ro'yxatdan
 * tanlash o'rniga pochta yorlig'idagi QR (`POST-…` / `PST-…`) o'qilsa — `GET post/scan/:token` (universal skaner
 * resolver'i, `fetchScanDetail`) pochtani aniqlaydi va `onOpen` pochta sahifasini kamera ochiq holda ochadi.
 *
 *   - pochta kodi emas (buyurtma, paket, market QR) — «Bu pochta QR kodi emas …», so'rov yo'q;
 *   - topilmadi (404 yoki javobda pochta yo'q) — «Pochta topilmadi» (oddiy topilmadi signali);
 *   - holat rejimga mos emas (jo'natishda yangi emas, qabulda rad etilgan emas) — sababi bilan, sahifa ochilmaydi;
 *   - topildi — «Pochta №… topildi» va `SCAN_OPEN_DELAY_MS` dan keyin `onOpen`.
 *
 * Holat eskirmasin — so'rov har safar yangidan (`staleTime: 0`). Kod aniqlanguncha keyingi skan «Oldingi kod
 * ochilmoqda» bilan rad etiladi; USB'da bir xil kod takrori «takror» signali bilan ushlanadi (universal skanerdagidek).
 */
export const useMailModeScan = ({ onOpen }: { onOpen: (mail: ScannedMail, kind: ScanMailKind) => void }) => {
  const { t } = useTranslation("scan");
  const queryClient = useQueryClient();
  const { evaluateScan } = useScannerGate({ cooldownMs: 0, duplicateCooldownMs: 1800 });
  const openingRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const [opening, setOpening] = useState<MailModeOpening | null>(null);
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onOpenRef.current = onOpen;
  });

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const handleScan = useCallback(
    async (raw: string, source: ScanSource, kind: ScanMailKind) => {
      const foreign = isForeignScanUrl(raw, window.location.origin);
      const extracted = foreign ? null : extractScannerToken(raw, window.location.origin);
      const token = extracted ? normalizeScanToken(extracted) : null;

      if (openingRef.current) {
        if (token !== openingRef.current) void playScanFeedback("error", t("scanner.previousOpening"), source);
        return;
      }
      if (source === "keyboard" && evaluateScan(raw, { ignoreCooldown: true }) === "duplicate") {
        void playScanFeedback("duplicate", undefined, source);
        return;
      }
      if (!token) {
        void playScanFeedback("error", t("scanner.invalid.title"), source);
        return;
      }
      if (getScanResourceType(token) !== "post") {
        void playScanFeedback("error", t("scanner.mail.notMail"), source);
        return;
      }

      const reset = () => {
        openingRef.current = null;
        setOpening(null);
      };
      openingRef.current = token;
      setOpening({ token, title: null });
      try {
        const response = await queryClient.fetchQuery({
          queryKey: getScanDetailQueryKey(token),
          queryFn: () => fetchScanDetail(token),
          staleTime: 0,
          retry: false,
          meta: { silentError: true },
        });
        const mail = response.type === "post" ? readScannedMail(response.data) : null;
        if (!mail) {
          reset();
          void playScanFeedback("missing", t("post.notFoundTitle"), source);
          return;
        }
        if (!isMailReadyFor(kind, mail.status)) {
          reset();
          void playScanFeedback("error", t(kind === "send" ? "scanner.sendMail.notReady" : "scanner.refusedMail.notReady"), source);
          return;
        }
        const title = t("scanner.mail.pickLabel", { id: mail.id });
        setOpening({ token, title });
        void playScanFeedback("success", t("scanner.found", { title }), source);
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          reset();
          onOpenRef.current(mail, kind);
        }, SCAN_OPEN_DELAY_MS);
      } catch (error) {
        reset();
        if (getErrorStatus(error) === 404) {
          void playScanFeedback("missing", t("post.notFoundTitle"), source);
          return;
        }
        void playScanFeedback("error", getBackendErrorMessage(error) ?? t("scanner.error.title"), source);
      }
    },
    [evaluateScan, queryClient, t],
  );

  return { handleScan, opening };
};
