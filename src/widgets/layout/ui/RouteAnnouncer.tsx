import { memo, useState } from "react";
import { useLocation } from "react-router-dom";
import { usePageTitle } from "../../../shared/lib/documentTitle";

/**
 * BO'LIM E'LONI (WuVeVZqo) — SPA o'tishida skrin-rider jim qolmasin: ko'rinmas jonli hudud yangi sahifa nomini
 * (`PageHeader` → `useDocumentTitle`) o'qiydi. Birinchi yuklanishda e'lon yo'q — sahifani skrin-rider o'zi o'qiydi.
 */
const RouteAnnouncer = () => {
  const { pathname } = useLocation();
  const page = usePageTitle();
  const [firstPath] = useState(pathname);
  const [navigated, setNavigated] = useState(false);
  // Birinchi o'tishdan keyin doim e'lon qilinadi (birinchi sahifaga qaytilganda ham).
  if (!navigated && pathname !== firstPath) setNavigated(true);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" id="route-announcer">
      {navigated && page ? page : ""}
    </div>
  );
};

export default memo(RouteAnnouncer);
