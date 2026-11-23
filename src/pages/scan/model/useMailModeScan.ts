import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { readQrScopeText } from "../../../shared/lib/coverageReasons";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import { playScanFeedback, type ScanSource } from "../../../shared/lib/scanner";
import { scanLookupFailureReason } from "../../../shared/lib/scanner/exactScanMatch";
import { extractScannerToken, isForeignScanUrl } from "../../../shared/lib/scanToken";
import { useScannerGate } from "../../../shared/lib/useScannerGate";
import {
  fetchScanDetail,
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
 * Holat eskirmasin — so'rov har safar yangidan (`staleTime: 0`). Kod aniqlanguncha BOSHQA pochta kodi kelsa — rad
 * etilmaydi, oxirgi skan ustun (skan auditi #97, universal skanerdagidek); o'sha kodning qo'shaloq o'qishi e'tiborsiz.
 * USB'da bir xil kod takrori «takror» signali bilan ushlanadi — faqat ochilgan pochtaga: topilmadi / xato / mos emas
 * bo'lsa token darvozadan chiqariladi (#30), darhol qayta skan qayta so'raydi.
 */
export const useMailModeScan = ({ onOpen }: { onOpen: (mail: ScannedMail, kind: ScanMailKind) => void }) => {
  const { t } = useTranslation("scan");
  const queryClient = useQueryClient();
  const { evaluateScan, releaseScan } = useScannerGate({ cooldownMs: 0, duplicateCooldownMs: 1800 });
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
      const isMail = token !== null && getScanResourceType(token) === "post";

      if (openingRef.current) {
        if (token === openingRef.current) return;
        // Pochta kodi bo'lmagan skan ochilayotgan pochtani to'xtatmaydi — faqat signal.
        if (!isMail) {
          void playScanFeedback("error", t(token ? "scanner.mail.notMail" : "scanner.invalid.title"), source);
          return;
        }
        // skan auditi #97: boshqa pochta kodi — oxirgi skan ustun.
        // Almashtirilgan kod takror himoyasida qolmasin (uning natijasi tashlanadi — qayta skan qayta so'raydi).
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = null;
        releaseScan(openingRef.current);
        openingRef.current = null;
        setOpening(null);
      }
      if (source === "keyboard" && evaluateScan(raw, { ignoreCooldown: true }) === "duplicate") {
        void playScanFeedback("duplicate", undefined, source);
        return;
      }
      if (!token) {
        releaseScan(raw);
        void playScanFeedback("error", t("scanner.invalid.title"), source);
        return;
      }
      if (!isMail) {
        releaseScan(raw);
        void playScanFeedback("error", t("scanner.mail.notMail"), source);
        return;
      }

      const isCurrent = () => openingRef.current === token;
      const reset = () => {
        openingRef.current = null;
        setOpening(null);
      };
      /** Ochilmadi — takror himoyasi olinadi: darhol qayta skan qayta so'raydi (#30). */
      const fail = () => {
        reset();
        releaseScan(raw);
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
        if (!isCurrent()) return;
        const mail = response.type === "post" ? readScannedMail(response.data) : null;
        if (!mail) {
          fail();
          void playScanFeedback("missing", t("post.notFoundTitle"), source);
          return;
        }
        if (!isMailReadyFor(kind, mail.status)) {
          fail();
          void playScanFeedback("error", t(kind === "send" ? "scanner.sendMail.notReady" : "scanner.refusedMail.notReady"), source);
          return;
        }
        const title = t("scanner.mail.pickLabel", { id: mail.id });
        setOpening({ token, title });
        // Faqat ochadi, hali hech narsa bajarilmagan — «Bajarildi» aytilmaydi.
        void playScanFeedback("success", t("scanner.found", { title }), source, { voice: false });
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          reset();
          onOpenRef.current(mail, kind);
        }, SCAN_OPEN_DELAY_MS);
      } catch (error) {
        if (!isCurrent()) return;
        fail();
        if (getErrorStatus(error) === 404) {
          void playScanFeedback("missing", t("post.notFoundTitle"), source);
          return;
        }
        // Begona pochta QR'i (#620: kuryerga 403 `post_not_visible_to_courier` …) — lokal matn; 5xx / 429 / tarmoq —
        // «topilmadi» emas, sababi bilan (#55).
        void playScanFeedback(
          "error",
          readQrScopeText(t, error)?.line ?? scanLookupFailureReason(t, error, { tooMany: t("scanner.tooMany") }),
          source,
        );
      }
    },
    [evaluateScan, queryClient, releaseScan, t],
  );

  return { handleScan, opening };
};
