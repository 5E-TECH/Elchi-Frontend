import { lazy, useState } from "react";
import { getPreloadedLoginPage, preloadLoginPage } from "./loginPagePreload";

const LazyLoginPage = lazy(preloadLoginPage);

/**
 * `/login` sahifasi (rzzxMItN). Odatda `lazy` — kirish sahifasi kodi boshqa sahifalarga yuklanmaydi.
 * To'g'ridan-to'g'ri `/login` ochilganda modul chizishdan oldin keladi (`main.tsx`) — birinchi chizishda forma darhol:
 * Suspense «Ilova yuklanmoqda» ekrani chaqnamaydi va logotip (LCP) ikkinchi marta so'ralmaydi.
 */
const LoginPage = () => {
  // Tanlov mount'da bir marta: modul keyin kelsa ham forma qayta o'rnatilmaydi (kiritilgan matn yo'qolmaydi).
  const [Page] = useState(() => getPreloadedLoginPage() ?? LazyLoginPage);
  return <Page />;
};

export default LoginPage;
