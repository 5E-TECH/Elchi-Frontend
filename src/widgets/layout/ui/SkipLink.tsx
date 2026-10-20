// dizayn-v2: superadmin-orders-list-skip-link
import { memo, type MouseEvent } from "react";
import { ArrowDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { buttonClasses } from "../../../shared/ui/primitives";
import { cx } from "../../../shared/lib/cx";

/** Shell kontent slotining `id` si — «Asosiy kontentga o'tish» nishoni (`tabIndex={-1}` bilan). */
export const MAIN_CONTENT_ID = "main-content";

/**
 * «Asosiy kontentga o'tish» (KI-S2, ega roziligi; maket `superadmin-orders-list-skip-link`).
 *
 * - Shell'ning BIRINCHI fokuslanadigan elementi (`DashboardLayout`, `ScanLayout`) — barcha rollar va sahifalarda.
 * - Ko'rinishi: ikkinchi darajali tugma (`buttonClasses({ variant: "secondary" })`) + `ArrowDown` 18, chap yuqorida
 *   (`fixed top-3 left-3`, maketdagi 12px), `z-60` — yuqori chiziq (`z-50`) va yuqori panel (`z-40`) ustida.
 *   Fokus halqasi — global `:focus-visible` (index.css).
 * - Faqat klaviatura fokusida (`:focus-visible`) ko'rinadi; qolgan vaqtda ekrandan tashqariga surilgan va shaffof —
 *   ekran o'quvchi va Tab uchun mavjud, sichqoncha bilan bosib bo'lmaydi.
 * - Bosilganda fokus `#main-content` ga o'tadi va u ko'rinadigan joyga suriladi. `preventDefault` — URL'ga `#hash`
 *   yozilmaydi (react-router yo'li va «Orqaga» tarixini buzmaydi).
 */
const SkipLink = () => {
  const { t } = useTranslation("sidebar");

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const target = document.getElementById(MAIN_CONTENT_ID);
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: "start" });
  };

  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      onClick={handleClick}
      data-skip-link=""
      className={buttonClasses({
        variant: "secondary",
        // O'tish (opacity, 150 ms, `motion-reduce` da yo'q) — tugmaning o'zida (`buttonClasses` BASE).
        className: cx(
          "fixed top-3 left-3 z-60",
          "pointer-events-none -translate-y-[calc(100%+1rem)] opacity-0",
          "focus-visible:pointer-events-auto focus-visible:translate-y-0 focus-visible:opacity-100",
        ),
      })}
    >
      <ArrowDown aria-hidden="true" size={18} className="shrink-0" />
      {t("skipToContent")}
    </a>
  );
};

export default memo(SkipLink);
