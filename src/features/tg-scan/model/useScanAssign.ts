// dizayn-v2: courier-scan-active, courier-scan-success-flash, courier-scan-other-courier, courier-scan-invalid
import { useCallback, useEffect, useRef, useState } from "react";
import { extractScannerToken } from "../../../shared/lib/scanToken";
import { useScannerGate } from "../../../shared/lib/useScannerGate";
import { scanAssignOrder, type ScanAssignResult, type ScanOrderSummary } from "../api/tgScanApi";
import { describeTgScanError, type TgScanErrorInfo } from "./scanError";
import { scanHaptic, type TelegramWebApp } from "./telegramWebApp";

/**
 * Uzluksiz skan oqimi: har o'qilgan QR → pauza/takror filtri → `POST /orders/scan-assign`.
 *
 * - Kamera bir QR'ni har kadrda qayta o'qiydi: bir xil token 1800 ms ichida jim tashlanadi, boshqa token
 *   700 ms ichida kelsa ham JIM kutiladi (v1 `/scan` bilan bir xil `useScannerGate`). Uzluksiz rejimda
 *   «Juda tez» xabari chiqarilmaydi: kamera QR'ni keyingi kadrlarda qayta o'qiydi va pauza o'tgach skan
 *   o'zi qabul qilinadi — «qayta skanerlang» deyish noto'g'ri bo'lardi. Telegram skaneri va USB skaner
 *   har skanni o'zi chegaralaydi — ularda umumiy pauza yo'q, faqat takror filtri.
 * - Kamerada turib qolgan o'sha posilka (oxirgi ishlangan token) qayta xabar bermaydi: qabul qilingan
 *   bo'lsa — umuman, xato bo'lsa — 6 s gacha (keyin qayta urinadi). Boshqa posilkadan keyin qabul
 *   qilingan token yana o'qilsa — so'rovsiz «Allaqachon qabul qilingan».
 * - Xato (boshqa filial, boshqa kuryerniki, noto'g'ri holat, topilmadi) oqimni TO'XTATMAYDI: xabar
 *   ko'rsatiladi, kamera ishlayveradi. 401 — `onSessionExpired` (token yangilanmaydi).
 * - Hisoblagich — muvaffaqiyatli javobdagi noyob `order_id` lar (`idempotent` ham: buyurtma hozir shu
 *   kuryerda, bot xulosasi ham uni sanaydi). «Tayyor» aynan shu ro'yxatni yuboradi.
 */

export type ScanSource = "camera" | "telegram" | "keyboard";

export type ScanSuccessEntry = {
  key: string;
  status: "assigned" | "already";
  token: string;
  orderId: string;
  order: ScanOrderSummary | null;
  at: number;
};

export type ScanFailedEntry = {
  key: string;
  status: "failed";
  token: string;
  error: TgScanErrorInfo;
  at: number;
};

export type ScanEntry = ScanSuccessEntry | ScanFailedEntry;

export type ScanFeedback =
  | { key: number; kind: "assigned" | "already" | "repeat"; entry: ScanSuccessEntry }
  | { key: number; kind: "failed"; entry: ScanFailedEntry }
  | { key: number; kind: "invalid" };

export type ScanFlashTone = "success" | "info" | "warning" | "error";

const CAMERA_COOLDOWN_MS = 700;
const DUPLICATE_COOLDOWN_MS = 1800;
/** Kamerada turib qolgan, xato bergan yoki yaroqsiz QR shu vaqtdan keyin qayta yuboriladi. */
const CAMERA_SAME_CODE_QUIET_MS = 6_000;
/** Xabar ekranda turadigan vaqt: xato — uzunroq (o'qib ulgurilsin). */
const FEEDBACK_MS = 3_000;
const FEEDBACK_ERROR_MS = 4_500;
/** Ramka rangli bo'lib turadigan vaqt (maket `courier-scan-success-flash`). */
const FLASH_MS = 1_200;
/** Ro'yxatda saqlanadigan oxirgi skanlar (hisoblagichga ta'sir qilmaydi). */
const MAX_ENTRIES = 100;

type FeedbackInput =
  | { kind: "assigned" | "already" | "repeat"; entry: ScanSuccessEntry }
  | { kind: "failed"; entry: ScanFailedEntry }
  | { kind: "invalid" };

const FLASH_OF: Record<FeedbackInput["kind"], ScanFlashTone> = {
  assigned: "success",
  already: "info",
  repeat: "info",
  failed: "error",
  invalid: "error",
};

type UseScanAssignOptions = {
  /** Mini App JWT (o'z mijozi). `assign` berilsa ishlatilmaydi. */
  accessToken?: string;
  webApp: TelegramWebApp | null;
  /** `false` — yangi skanlar qabul qilinmaydi (masalan «Tayyor» yuborilmoqda). */
  enabled: boolean;
  onSessionExpired: () => void;
  /**
   * So'rov (sukut — Mini App mijozi `scanAssignOrder(accessToken, token)`). Asosiy ilovadagi universal skaner
   * (kuryer «O'zimga olish», `pages/scan`) asosiy `api` bilan beradi — oqim mantig'i bitta.
   */
  assign?: (token: string) => Promise<ScanAssignResult>;
  /** Har natija xabari (ovoz, kamera xabari — asosiy ilovada `playScanFeedback`). */
  onFeedback?: (feedback: ScanFeedback) => void;
};

export const useScanAssign = ({
  accessToken = "",
  webApp,
  enabled,
  onSessionExpired,
  assign,
  onFeedback,
}: UseScanAssignOptions) => {
  const { evaluateScan, resetScannerGate } = useScannerGate({
    cooldownMs: CAMERA_COOLDOWN_MS,
    duplicateCooldownMs: DUPLICATE_COOLDOWN_MS,
  });
  const [entries, setEntries] = useState<ScanEntry[]>([]);
  const [acceptedOrderIds, setAcceptedOrderIds] = useState<string[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [flash, setFlash] = useState<ScanFlashTone | null>(null);

  const assignedRef = useRef(new Map<string, ScanSuccessEntry>());
  const pendingRef = useRef(new Set<string>());
  const inflightRef = useRef(new Set<Promise<void>>());
  /** Kamera oxirgi ishlagan kod (token yoki yaroqsiz qiymat) va vaqti. */
  const lastCameraCodeRef = useRef<{ code: string; at: number } | null>(null);
  const acceptedRef = useRef<string[]>([]);
  const sequenceRef = useRef(0);
  const feedbackTimerRef = useRef(0);
  const flashTimerRef = useRef(0);
  const mountedRef = useRef(true);
  const optionsRef = useRef({ accessToken, webApp, enabled, onSessionExpired, assign, onFeedback });

  useEffect(() => {
    optionsRef.current = { accessToken, webApp, enabled, onSessionExpired, assign, onFeedback };
  }, [accessToken, webApp, enabled, onSessionExpired, assign, onFeedback]);

  useEffect(() => {
    mountedRef.current = true;
    resetScannerGate();
    return () => {
      mountedRef.current = false;
      window.clearTimeout(feedbackTimerRef.current);
      window.clearTimeout(flashTimerRef.current);
    };
  }, [resetScannerGate]);

  const show = useCallback((input: FeedbackInput) => {
    sequenceRef.current += 1;
    const next = { ...input, key: sequenceRef.current } as ScanFeedback;
    setFeedback(next);
    optionsRef.current.onFeedback?.(next);
    setFlash(FLASH_OF[input.kind]);
    window.clearTimeout(feedbackTimerRef.current);
    window.clearTimeout(flashTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(
      () => setFeedback(null),
      input.kind === "failed" || input.kind === "invalid" ? FEEDBACK_ERROR_MS : FEEDBACK_MS,
    );
    flashTimerRef.current = window.setTimeout(() => setFlash(null), FLASH_MS);
  }, []);

  const submit = useCallback(
    async (token: string) => {
      const { accessToken: jwt, webApp: app, assign: request } = optionsRef.current;
      pendingRef.current.add(token);
      setPendingCount((count) => count + 1);
      try {
        const result = await (request ? request(token) : scanAssignOrder(jwt, token));
        if (!mountedRef.current) return;
        const entry: ScanSuccessEntry = {
          key: `${Date.now()}-${sequenceRef.current}-${token}`,
          status: result.idempotent ? "already" : "assigned",
          token,
          orderId: result.order_id,
          order: result.order,
          at: Date.now(),
        };
        assignedRef.current.set(token, entry);
        setEntries((previous) => [entry, ...previous].slice(0, MAX_ENTRIES));
        if (!acceptedRef.current.includes(entry.orderId)) {
          acceptedRef.current = [...acceptedRef.current, entry.orderId];
          setAcceptedOrderIds(acceptedRef.current);
        }
        show({ kind: entry.status, entry });
        scanHaptic(app, result.idempotent ? "light" : "success");
      } catch (error) {
        if (!mountedRef.current) return;
        const info = describeTgScanError(error);
        if (info.kind === "session") {
          optionsRef.current.onSessionExpired();
          return;
        }
        const entry: ScanFailedEntry = {
          key: `${Date.now()}-${sequenceRef.current}-${token}`,
          status: "failed",
          token,
          error: info,
          at: Date.now(),
        };
        setEntries((previous) => [entry, ...previous].slice(0, MAX_ENTRIES));
        show({ kind: "failed", entry });
        scanHaptic(app, "error");
      } finally {
        pendingRef.current.delete(token);
        if (mountedRef.current) setPendingCount((count) => Math.max(0, count - 1));
      }
    },
    [show],
  );

  /** Kamera, Telegram skaneri yoki USB skaner o'qigan xom qiymat. */
  const handleScan = useCallback(
    (rawValue: string, source: ScanSource) => {
      const { enabled: isEnabled, webApp: app } = optionsRef.current;
      if (!isEnabled) return;
      const verdict = evaluateScan(rawValue, { ignoreCooldown: source !== "camera" });
      if (verdict !== "accepted") return;
      const token = extractScannerToken(rawValue, window.location.origin);
      if (source === "camera") {
        const code = token ?? rawValue.trim();
        const now = Date.now();
        const last = lastCameraCodeRef.current;
        if (last?.code === code && (assignedRef.current.has(code) || now - last.at < CAMERA_SAME_CODE_QUIET_MS)) return;
        lastCameraCodeRef.current = { code, at: now };
      }
      if (!token) {
        show({ kind: "invalid" });
        scanHaptic(app, "error");
        return;
      }
      const known = assignedRef.current.get(token);
      if (known) {
        show({ kind: "repeat", entry: known });
        scanHaptic(app, "light");
        return;
      }
      if (pendingRef.current.has(token)) return;
      const request = submit(token);
      inflightRef.current.add(request);
      void request.finally(() => inflightRef.current.delete(request));
    },
    [evaluateScan, show, submit],
  );

  /**
   * «Tayyor» oldidan: yo'ldagi skan so'rovlari tugashini kutadi va yakuniy qabul qilingan id'larni beradi
   * (oxirgi skan javobi kelmasdan xulosa yuborilib, u hisobdan tushib qolmasin).
   */
  const settle = useCallback(async () => {
    while (inflightRef.current.size > 0) {
      await Promise.allSettled([...inflightRef.current]);
    }
    return acceptedRef.current;
  }, []);

  return { entries, acceptedOrderIds, pendingCount, feedback, flash, handleScan, settle };
};
