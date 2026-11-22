import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
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
  | {
      kind: "error";
      raw: string;
      at: number;
      message: string | null;
      /** Begona QR (#620): lokal sarlavha («Bu buyurtma sizning filialingizda emas»); yo'q — «Kodni tekshirib bo'lmadi». */
      title?: string | null;
      /** Ruxsat yo'q (qulf ikonkasi), vaqtinchalik xato emas. */
      forbidden?: boolean;
    };

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
 *     saralanmaydi; USB'da pauza yo'q, faqat bir xil kod takrori «takror» ovozi bilan ushlanadi. Takror faqat
 *     OCHILGAN kodga: topilmadi / xato / yaroqsiz bo'lsa token darvozadan chiqariladi (`releaseScan`, skan auditi
 *     #30, #53) — darhol qayta skan qayta so'raydi, «Allaqachon skanerlangan» demaydi;
 *   - kod aniqlanguncha (`fetchQuery`, javob keshga tushadi — natija sahifasi darhol chiziladi) BOSHQA kod kelsa —
 *     rad etilmaydi (skan auditi #97): oxirgi skan ustun, oldingisining natijasi tashlanadi (bu rejim faqat
 *     ko'rsatadi, hech narsa bajarilmagan — yo'qotiladigan amal yo'q). O'sha kodning o'zi (qo'shaloq o'qish) —
 *     e'tiborsiz, uning natija signali baribir keladi. Yaroqsiz / market QR esa ochilayotgan kodni to'xtatmaydi;
 *   - topildi → «№… topildi» + `SCAN_OPEN_DELAY_MS` dan keyin natija sahifasi;
 *   - topilmadi / yaroqsiz QR / market QR / xato → skaner ochiq qoladi (uzluksiz), natija kamerada va
 *     desktopda «Natija» kartasida; market QR (`MCR-`) hech qachon so'ralmaydi (bir martalik, backend yeydi);
 *   - begona QR (#620, anKpzwxk): `order_not_in_your_branch`, `branch_not_assigned`, `post_not_visible_to_courier`,
 *     `branch_scope_unavailable` — «Kodni tekshirib bo'lmadi» o'rniga lokal sarlavha (`common:coverage.*`), xato
 *     signali; buyurtma ma'lumoti yo'q (javobda ham yo'q).
 */
export const useUniversalScan = () => {
  const { t, i18n } = useTranslation("scan");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { evaluateScan, releaseScan } = useScannerGate({ cooldownMs: 0, duplicateCooldownMs: 1800 });
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
      const resource = token ? getScanResourceType(token) : null;

      if (openingRef.current) {
        // O'sha kod hali tekshirilmoqda / ochilmoqda (USB qo'shaloq o'qishi) — natija signali baribir keladi.
        if (token === openingRef.current) return;
        // Yaroqsiz yoki market QR ochilayotgan kodni to'xtatmaydi — faqat signal.
        if (!token || resource === "market-qr") {
          void playScanFeedback("error", t(token ? "scanner.marketQr.title" : "scanner.invalid.title"), source);
          return;
        }
        // skan auditi #97: boshqa kod rad etilmaydi — oxirgi skan ustun (oldingisi faqat ochilayotgan edi).
        // Almashtirilgan kod takror himoyasida qolmasin (uning natijasi tashlanadi — qayta skan qayta so'raydi).
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = null;
        releaseScan(openingRef.current);
        openingRef.current = null;
        setOpening(null);
      }

      // HID skaneri: pauza yo'q, faqat ataylab qilingan takror signal bilan bildiriladi.
      if (source === "keyboard" && evaluateScan(raw, { ignoreCooldown: true }) === "duplicate") {
        void playScanFeedback("duplicate", undefined, source);
        return;
      }

      const at = Date.now();
      if (!token || !resource) {
        releaseScan(raw);
        setOutcome({ kind: "invalid", raw, at });
        void playScanFeedback("error", t("scanner.invalid.title"), source);
        return;
      }

      if (resource === "market-qr") {
        releaseScan(raw);
        setOutcome({ kind: "market-qr", raw: token, at });
        void playScanFeedback("error", t("scanner.marketQr.title"), source);
        return;
      }

      openingRef.current = token;
      setOutcome(null);
      setOpening({ token, title: null, entry: null });
      /** Bu skan hali joriymi — keyingi kod uni almashtirgan bo'lsa natijasi tashlanadi (#97). */
      const isCurrent = () => openingRef.current === token;
      /** Ochilmadi: takror himoyasi olinadi — darhol qayta skan qayta so'raydi (#30, #53). */
      const settleFailed = () => {
        openingRef.current = null;
        setOpening(null);
        releaseScan(raw);
      };
      try {
        const response = await queryClient.fetchQuery({
          queryKey: getScanDetailQueryKey(token),
          queryFn: () => fetchScanDetail(token),
          retry: false,
          meta: { silentError: true },
        });
        if (!isCurrent()) return;
        const entry = toScanHistoryEntry(token, response, at);
        if (!entry) {
          settleFailed();
          setOutcome({ kind: "not-found", raw: token, at, resource });
          void playScanFeedback("missing", t(`${notFoundTextKey(resource)}.notFoundTitle`), source);
          return;
        }
        const title = scanHistoryTitle(t, entry, language);
        setOpening({ token, title, entry });
        // Faqat ochadi, hali hech narsa bajarilmagan — «Bajarildi» aytilmaydi.
        void playScanFeedback("success", t("scanner.found", { title }), source, { voice: false });
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          navigate(`/scan/${encodeURIComponent(token)}`);
        }, SCAN_OPEN_DELAY_MS);
      } catch (error) {
        if (!isCurrent()) return;
        settleFailed();
        // Faqat 404 — «topilmadi»; 5xx / 504 / 429 / tarmoq — «Kodni tekshirib bo'lmadi» va sababi (#55).
        if (getErrorStatus(error) === 404) {
          setOutcome({ kind: "not-found", raw: token, at, resource });
          void playScanFeedback("missing", t(`${notFoundTextKey(resource)}.notFoundTitle`), source);
          return;
        }
        const scope = readQrScopeText(t, error);
        if (scope) {
          setOutcome({
            kind: "error",
            raw: token,
            at,
            title: scope.title,
            message: scope.description || null,
            forbidden: !scope.retryable,
          });
          void playScanFeedback("error", scope.line, source);
          return;
        }
        const message = scanLookupFailureReason(t, error, { tooMany: t("scanner.tooMany") });
        setOutcome({ kind: "error", raw: token, at, message });
        void playScanFeedback("error", message, source);
      }
    },
    [evaluateScan, language, navigate, queryClient, releaseScan, t],
  );

  return { handleScan, opening, outcome };
};
