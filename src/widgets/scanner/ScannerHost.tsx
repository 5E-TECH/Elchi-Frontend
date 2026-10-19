// dizayn-v2: shell
import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  closeScanner,
  openScanner,
  readScannerArrival,
  registerScannerNavigator,
  SCANNER_ARRIVAL_TIMEOUT_MS,
  SCANNER_TARGET_SWITCH_GRACE_MS,
  useScannerCameraMounted,
  useScannerOverlayOpen,
  withoutScannerArrival,
  type ScannerArrival,
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
 * Shu oraliqda kamera faqat KO'RINADI (`suspended`): eski maqsadning sarlavhasi va hisoblagichi turadi, lekin
 * skan, qo'lda kiritish, «Bekor qilish», almashtirish va «Tugatish» eski sahifaning handler'lariga yetmaydi
 * (aks holda o'qilgan kod yopilgan sahifaga — masalan oldingi marketning ro'yxatiga — tushardi).
 * Kamera kodi alohida bo'lak (`lazy`): shell bilan QR kutubxonasi yuklanmaydi.
 *
 * «Kelganda och» (3-bosqich): universal skaner (`/scan`, shell'dan tashqarida) rejimidan kelingan bo'lsa
 * (router holatida `scannerArrivalState`) — kelgan sahifaning maqsadi ro'yxatdan o'tgach kamera ochiladi,
 * `/scan` da o'qilgan kod (`pendingScan`) kamera chizilgach sahifa handler'iga beriladi. Bayroq tarixdan
 * DARHOL tozalanadi (`replace`), kutish faqat xotirada: maqsad kelmay sahifadan ketilsa, oldinga/orqaga
 * qaytish yoki yangilash kamerani kutilmaganda ochmaydi. Kutish `SCANNER_ARRIVAL_TIMEOUT_MS` dan keyin yoki
 * boshqa sahifaga o'tilsa bekor bo'ladi.
 */
const ScannerHost = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const open = useScannerOverlayOpen();
  const target = useActiveScanTarget();
  const cameraMounted = useScannerCameraMounted();
  // Kamera chizilishini kutayotgan kod (natija xabari kamera ichida ko'rinsin).
  const pendingScanRef = useRef<{ targetId: string; scan: NonNullable<ScannerArrival["pendingScan"]> } | null>(null);
  // Kelgan sahifa maqsadini kutish (bayroq tarixdan olingan): qaysi sahifada va qachongacha.
  const awaitingRef = useRef<{ arrival: ScannerArrival; pathname: string; deadline: number } | null>(null);

  // Oxirgi faol maqsad — almashish oralig'ida (maqsad vaqtincha yo'q) kamera shu bilan turadi.
  const [held, setHeld] = useState<ScanTarget | null>(target);
  if (target && target !== held) setHeld(target);

  useEffect(() => registerScannerNavigator((to) => navigate(to)), [navigate]);

  useEffect(() => {
    const arrival = readScannerArrival(location.state);
    if (arrival) {
      awaitingRef.current = { arrival, pathname: location.pathname, deadline: Date.now() + SCANNER_ARRIVAL_TIMEOUT_MS };
      // Bayroq darhol tozalanadi (`replace`): orqaga/oldinga qaytish yoki yangilash kamerani qayta ochmaydi.
      navigate(
        { pathname: location.pathname, search: location.search, hash: location.hash },
        { replace: true, state: withoutScannerArrival(location.state) },
      );
    }
    const awaiting = awaitingRef.current;
    if (!awaiting) return;
    if (location.pathname !== awaiting.pathname || Date.now() > awaiting.deadline) {
      awaitingRef.current = null;
      return;
    }
    if (!target || (awaiting.arrival.targetId && target.id !== awaiting.arrival.targetId)) return;
    awaitingRef.current = null;
    const pending = awaiting.arrival.pendingScan;
    pendingScanRef.current = pending ? { targetId: target.id, scan: pending } : null;
    openScanner();
  }, [location, navigate, target]);

  useEffect(() => {
    const pending = pendingScanRef.current;
    if (!pending || !open || !cameraMounted || !target) return;
    pendingScanRef.current = null;
    // Kutilgan maqsad o'rniga boshqasi (sahifadan ketildi) — kod hech qayerga yuborilmaydi.
    if (target.id !== pending.targetId) return;
    void Promise.resolve()
      .then(() => target.onScan(pending.scan.raw, pending.scan.source))
      .catch(() => undefined);
  }, [cameraMounted, open, target]);

  useEffect(() => {
    if (!open || target) return undefined;
    const timer = window.setTimeout(closeScanner, SCANNER_TARGET_SWITCH_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [open, target]);

  // Shell yopilsa (chiqish, boshqa layout) oyna ochiq holatda qolib ketmasin.
  useEffect(() => () => closeScanner(), []);

  const frozen = useMemo(() => (held ? freezeTarget(held) : null), [held]);
  const shown = target ?? frozen;
  if (!open || !shown) return null;

  return (
    <Suspense fallback={null}>
      <ScannerCamera presentation="overlay" target={shown} suspended={!target} onClose={closeScanner} />
    </Suspense>
  );
};

/** Almashish oralig'i uchun maqsad nusxasi: faqat ko'rinish, hech bir handler eski sahifaga yetmaydi. */
const freezeTarget = (target: ScanTarget): ScanTarget => ({
  id: target.id,
  title: target.title,
  context: target.context,
  hint: target.hint,
  icon: target.icon,
  progress: target.progress,
  stats: target.stats,
  note: target.note,
  listTitle: target.listTitle,
  listDescription: target.listDescription,
  listNote: target.listNote,
  list: target.list?.map((item) => ({
    key: item.key,
    title: item.title,
    subtitle: item.subtitle,
    tone: item.tone,
    icon: item.icon,
  })),
  onScan: () => undefined,
});

export default memo(ScannerHost);
