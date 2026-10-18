import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { SCANNER_ROUTE } from "./routes";

/**
 * Amal muvaffaqiyatidan keyin skanerga qaytish taymeri («O'zimga olish» — 1500 ms, paket qabuli —
 * 2000 ms). Taymer ref'da: komponent yo'qolsa (USB skaner bilan keyingi posilka ochildi — natija bloki
 * yangi token bilan qayta o'rnatiladi) u bekor qilinadi va operatorni eski sahifadan `/scan` ga tortmaydi.
 */
export const useScanRedirect = (delayMs: number) => {
  const navigate = useNavigate();
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  return useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => navigate(SCANNER_ROUTE), delayMs);
  }, [delayMs, navigate]);
};
