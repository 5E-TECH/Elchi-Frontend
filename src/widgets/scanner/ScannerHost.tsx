// dizayn-v2: shell
import { lazy, memo, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  closeScanner,
  registerScannerNavigator,
  SCANNER_TARGET_SWITCH_GRACE_MS,
  useScannerOverlayOpen,
} from "../../shared/lib/scanner/scannerHost";
import { useActiveScanTarget, type ScanTarget } from "../../shared/lib/scanner/scanTargets";
import { loadScannerCamera } from "../../shared/ui/camera/loadScannerCamera";

const ScannerCamera = lazy(loadScannerCamera);

/**
 * SKANER OYNASI MANZILI — shell'da (`dashboardLayout`) bir marta o'rnatiladi (ega roziligi 2026-10-19,
 * Trello v1eLN2tV 1-bosqich: «markaziy tugma kontekstli»).
 *
 *   - `openScanner()` (pastki menyu «Skaner», yuqori panel «Skanerlash») faol skan maqsadi bo'lsa shu yerda
 *     kamerani SAHIFA USTIDA ochadi — navigatsiyasiz, sahifa holati (tanlov, filtr, skroll) saqlanadi;
 *   - maqsad yo'q bo'lsa `openScanner` router orqali `/scan` ga o'tadi (navigatsiya shu yerda beriladi).
 *
 * Faol maqsad almashsa (ega, «F»: kamera ichida market tanlandi → `/new-orders/:boshqaMarketId`, yangi sahifa o'z
 * maqsadini ro'yxatdan o'tkazdi) — kamera OCHIQ qoladi va yangi maqsad bilan davom etadi (oqim uzilmaydi).
 * Maqsad umuman yo'qolsa (boshqa bo'limga o'tildi, oqim tugadi) — `SCANNER_TARGET_SWITCH_GRACE_MS` dan keyin yopiladi.
 * Kamera kodi alohida bo'lak (`lazy`): shell bilan QR kutubxonasi yuklanmaydi.
 */
const ScannerHost = () => {
  const navigate = useNavigate();
  const open = useScannerOverlayOpen();
  const target = useActiveScanTarget();
  // Oxirgi faol maqsad — almashish oralig'ida (maqsad vaqtincha yo'q) kamera shu bilan turadi.
  const [held, setHeld] = useState<ScanTarget | null>(target);
  if (target && target !== held) setHeld(target);

  useEffect(() => registerScannerNavigator((to) => navigate(to)), [navigate]);

  useEffect(() => {
    if (!open || target) return undefined;
    const timer = window.setTimeout(closeScanner, SCANNER_TARGET_SWITCH_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [open, target]);

  // Shell yopilsa (chiqish, boshqa layout) oyna ochiq holatda qolib ketmasin.
  useEffect(() => () => closeScanner(), []);

  const shown = target ?? held;
  if (!open || !shown) return null;

  return (
    <Suspense fallback={null}>
      <ScannerCamera presentation="overlay" target={shown} onClose={closeScanner} />
    </Suspense>
  );
};

export default memo(ScannerHost);
