import { useCallback, useRef } from "react";
import { extractScannerToken } from "./scanToken";

type ScannerGateOptions = {
  cooldownMs?: number;
  duplicateCooldownMs?: number;
  /**
   * Kamera uchun (uzluksiz skaner, oyna har skandan keyin yopilmaydi): kadrda turgan kod har o'qilganda
   * takror oynasi SURILADI — kod ramkada turgan ekan, u qayta qabul qilinmaydi (aks holda har 1,8 s da
   * yana so'rov / «topilmadi» ovozi). Kod ramkadan chiqib, `duplicateCooldownMs` o'tgach — yana qabul.
   * Takror pauzani uzaytirmaydi: pauza faqat QABUL qilingan skandan hisoblanadi, shunda A kodi kadrda
   * qolib turganda B kodi «juda tez» ga tushib qolmaydi. Sukut (`false`) — USB va eski sahifalar o'zgarmaydi.
   */
  slidingDuplicate?: boolean;
};

/**
 * Skan natijasi. `cooldown` va `duplicate` — rad etilgan skanlar; ularni
 * JIM tashlash xavfli (operator "skanerlandi" deb o'ylaydi), shu sabab
 * chaqiruvchi sababni bilishi kerak.
 */
export type ScanGateVerdict = "accepted" | "cooldown" | "duplicate";

export const useScannerGate = ({
  cooldownMs = 900,
  duplicateCooldownMs = 2200,
  slidingDuplicate = false,
}: ScannerGateOptions = {}) => {
  const nextAllowedScanAtRef = useRef(0);
  const lastTokenRef = useRef("");
  const lastTokenAtRef = useRef(0);

  /**
   * `ignoreCooldown` — HID (klaviatura) skaneri uchun: u har skanni Enter
   * bilan o'zi chegaralaydi, umumiy pauza faqat skanlarni yo'qotadi.
   * Dublikat himoyasi (bir xil token ketma-ket) baribir ishlaydi.
   */
  const evaluateScan = useCallback((rawValue: string, { ignoreCooldown = false } = {}): ScanGateVerdict => {
    const now = Date.now();
    const normalizedToken =
      extractScannerToken(rawValue, typeof window !== "undefined" ? window.location.origin : undefined) ??
      rawValue.trim();
    const tokenKey = normalizedToken.trim().toLowerCase();

    // Takror pauzadan OLDIN tekshiriladi: kamera bir QR'ni har kadrda qayta
    // o'qiydi — bu "juda tez" xatosi emas, jim o'tkazib yuboriladigan takror.
    if (
      tokenKey &&
      tokenKey === lastTokenRef.current &&
      now - lastTokenAtRef.current < duplicateCooldownMs
    ) {
      if (slidingDuplicate) lastTokenAtRef.current = now;
      else nextAllowedScanAtRef.current = now + cooldownMs;
      return "duplicate";
    }

    if (!ignoreCooldown && now < nextAllowedScanAtRef.current) return "cooldown";

    lastTokenRef.current = tokenKey;
    lastTokenAtRef.current = now;
    nextAllowedScanAtRef.current = now + cooldownMs;
    return "accepted";
  }, [cooldownMs, duplicateCooldownMs, slidingDuplicate]);

  const canAcceptScan = useCallback(
    (rawValue: string) => evaluateScan(rawValue) === "accepted",
    [evaluateScan],
  );

  const blockScans = useCallback((durationMs = cooldownMs) => {
    nextAllowedScanAtRef.current = Date.now() + durationMs;
  }, [cooldownMs]);

  const resetScannerGate = useCallback(() => {
    nextAllowedScanAtRef.current = 0;
    lastTokenRef.current = "";
    lastTokenAtRef.current = 0;
  }, []);

  return {
    evaluateScan,
    canAcceptScan,
    blockScans,
    resetScannerGate,
  };
};
