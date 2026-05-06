import { useCallback, useRef } from "react";
import { extractScannerToken } from "./scanToken";

type ScannerGateOptions = {
  cooldownMs?: number;
  duplicateCooldownMs?: number;
};

export const useScannerGate = ({
  cooldownMs = 900,
  duplicateCooldownMs = 2200,
}: ScannerGateOptions = {}) => {
  const nextAllowedScanAtRef = useRef(0);
  const lastTokenRef = useRef("");
  const lastTokenAtRef = useRef(0);

  const canAcceptScan = useCallback((rawValue: string) => {
    const now = Date.now();
    if (now < nextAllowedScanAtRef.current) return false;

    const normalizedToken =
      extractScannerToken(rawValue, typeof window !== "undefined" ? window.location.origin : undefined) ??
      rawValue.trim();
    const tokenKey = normalizedToken.trim().toLowerCase();

    if (
      tokenKey &&
      tokenKey === lastTokenRef.current &&
      now - lastTokenAtRef.current < duplicateCooldownMs
    ) {
      nextAllowedScanAtRef.current = now + cooldownMs;
      return false;
    }

    lastTokenRef.current = tokenKey;
    lastTokenAtRef.current = now;
    nextAllowedScanAtRef.current = now + cooldownMs;
    return true;
  }, [cooldownMs, duplicateCooldownMs]);

  const blockScans = useCallback((durationMs = cooldownMs) => {
    nextAllowedScanAtRef.current = Date.now() + durationMs;
  }, [cooldownMs]);

  const resetScannerGate = useCallback(() => {
    nextAllowedScanAtRef.current = 0;
    lastTokenRef.current = "";
    lastTokenAtRef.current = 0;
  }, []);

  return {
    canAcceptScan,
    blockScans,
    resetScannerGate,
  };
};
