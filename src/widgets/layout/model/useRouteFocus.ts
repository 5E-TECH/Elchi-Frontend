import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { MAIN_CONTENT_ID } from "../ui/SkipLink";

/**
 * BO'LIM ALMASHGANDA FOKUS (WuVeVZqo) — yon menyu, pastki menyu yoki yuqori paneldan o'tilganda fokus kontentga
 * (`#main-content`, `tabIndex=-1`, ramkasiz) ko'chadi: Tab yangi sahifadan davom etadi, menyu boshidan emas. Fokus
 * allaqachon kontent ichida bo'lsa (sahifa ichidagi tab, havola) — tegilmaydi. Skroll joyi `useShellScroll` da.
 */
export const useRouteFocus = () => {
  const { pathname } = useLocation();
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    const content = document.getElementById(MAIN_CONTENT_ID);
    if (!content || content.contains(document.activeElement)) return;
    content.focus({ preventScroll: true });
  }, [pathname]);
};
