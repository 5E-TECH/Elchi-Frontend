import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { notify } from "../../../shared/lib/notify";

/**
 * Oxirgi `null` bo'lmagan qiymat — oyna yopilish harakati (200 ms, `usePresence`) davomida mazmun o'zgarmasin:
 * ota `account` ni darhol `null` qiladi (yoki ro'yxat yangilanib holat almashadi), oyna esa so'nib bo'lguncha
 * o'sha akkaunt bilan chiziladi (integratsiyalar oynalari qoidasi — `PayResultDialog`, `CancelRemittanceDialog`).
 * Holat render paytida yangilanadi (effektsiz, `ConfirmDialog` dagi `wasOpen` kabi).
 */
export const useRetained = <T>(value: T | null): T | null => {
  const [kept, setKept] = useState<T | null>(value);
  if (value !== null && value !== kept) setKept(value);
  return value ?? kept;
};

/** Bitta «Orqaga» hodisasini bir nechta faol himoya (kalitni yangilash so'rovi + kalit oynasi) ikki marta qaytarmasin. */
const handledPops = new WeakSet<Event>();

/**
 * Sahifadan chiqishdan himoya — bir martalik kalit yo'qolmasin: yaratish yoki kalitni yangilash so'rovi ketayotganda
 * (server kalitni almashtirib bo'lgan bo'lishi mumkin, yangisi faqat shu javobda) va kalit oynasi «nusxaladim»
 * belgisisiz ochiq turganda.
 *  - sahifani yangilash / yopish — brauzer tasdig'i (`beforeunload`);
 *  - brauzer «Orqaga» / «Oldinga», Android orqaga tugmasi, iOS chekkadan surish (`popstate`) — o'tish bekor qilinadi:
 *    joriy manzil darhol qayta qo'yiladi va sabab xabarda aytiladi. Busiz router oldingi yozuvni (`?scope=…`,
 *    `/integrations/new`) chizib konsolni yopardi — oynadagi kalit, ketayotgan so'rovning javobi esa hech kimga
 *    yetmasdi. Ilova `BrowserRouter` da — `useBlocker` yo'q.
 * Ilova ichidagi havolalar modal oyna ortida yopiq; oyna ichidagi havola so'rov ketayotganda chizilmaydi.
 */
export const useLeaveGuard = (active: boolean) => {
  const { t } = useTranslation("integrations");
  const navigate = useNavigate();
  const location = useLocation();
  /** Joriy manzil: `popstate` paytida `window.location` allaqachon oldingi yozuvda — qaytiladigan joy shu. */
  const hereRef = useRef(location);
  useLayoutEffect(() => {
    hereRef.current = location;
  }, [location]);

  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onPopState = (event: PopStateEvent) => {
      if (handledPops.has(event)) return;
      handledPops.add(event);
      const { pathname, search, hash, state } = hereRef.current;
      // Router orqali (uning `idx` hisobi buzilmasin): ikkala yangilanish bitta o'tishda — oldingi sahifa chizilmaydi.
      navigate({ pathname, search, hash }, { state });
      notify.warning(t("carrier.leaveBlocked.title"), {
        description: t("carrier.leaveBlocked.text"),
      });
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    // `capture` — router'ning `popstate` tinglovchisidan OLDIN: u o'qiydigan manzil allaqachon joriy sahifa.
    window.addEventListener("popstate", onPopState, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState, true);
    };
  }, [active, navigate, t]);
};

/**
 * Oyna necha marta ochilgani (`false → true` o'tishlar). Forma shu son bilan `key` oladi: har ochilishda toza
 * holatdan boshlanadi, yopilganda esa o'sha nusxa qoladi — yopilish harakati (200 ms) to'ldirilgan qiymatlar bilan
 * so'nadi (forma yopilish paytida bo'shab qolmaydi) va ochiq turganda ro'yxat yangilansa kiritilgani yo'qolmaydi.
 */
export const useOpenCount = (open: boolean): number => {
  const [count, setCount] = useState(open ? 1 : 0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setCount(count + 1);
  }
  return count;
};
