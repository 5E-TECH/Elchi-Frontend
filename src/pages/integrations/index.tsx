// dizayn-v2: superadmin-integrations-partners-console, admin-integrations-partners
import { Outlet } from "react-router-dom";

/**
 * INTEGRATSIYALAR UYI — faqat o'ram (`/integrations/*` bolalari shu yerda chiziladi).
 *
 * Dizayn v2 (ega qarori D2): «Hamkorlar · Tashqi tizimlar · Marketplace» tablari endi sahifa
 * tepasida EMAS — ular konsol kartasining ichida (`ConnectionsPage`, maket `*-partners-console`).
 * Katalog, usta va eski sahifalarda tepada tab yo'q, o'rniga `PageHeader` «← …» havolasi.
 * Tab tanlovi avvalgidek URL'da (`/integrations/connections?scope=<k>`).
 */
const IntegrationsPage = () => <Outlet />;

export default IntegrationsPage;
