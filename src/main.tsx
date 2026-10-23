import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./app/ui/App";
import { registerBeforeLogout } from "./auth/authService";
import { unsubscribePushOnLogout } from "./features/push-notifications/lib/pushClient";
import { captureInstallPrompt } from "./features/pwa-install/lib/installPrompt";
import { preloadLoginPage } from "./app/lib/loginPagePreload";
import { i18nReady, startsOnLogin } from "./i18n";

// «Brauzeringiz eskirgan» zaxira bloki (index.html, js9ndYwA): ilova kodi ishga tushdi — brauzer uni o'qiy oldi, blok
// kerak emas. Chizishni (tarjimalar, sekin tarmoqda 8 s dan ko'p bo'lishi mumkin) KUTMASDAN olib tashlanadi —
// aks holda yangi brauzerda ham soxta «eskirgan» ekrani chiqardi.
document.getElementById("legacy-fallback")?.remove();

// «Ilovani o'rnatish» (KI-2): `beforeinstallprompt` sahifa yuklanishi bilan bir marta keladi — tarjimalar va birinchi
// chizishni KUTMASDAN ushlanadi (aks holda hodisa o'tib ketadi va «O'rnatish» tugmasi chiqmaydi).
captureInstallPrompt();

// Tanlangan til (ru/en) fayllari yuklangach chiziladi — bir lahza o'zbekcha
// matn ko'rinib qolmasin.
const render = () =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
// To'g'ridan-to'g'ri `/login`: kirish sahifasi moduli ham tarjimalar bilan parallel — birinchi chizishda forma
// (`app/lib/loginPage.tsx`). Yuklanmasa — oddiy `lazy` yo'li.
const firstScreen = startsOnLogin() ? preloadLoginPage().catch(() => undefined) : undefined;
void Promise.all([i18nReady, firstScreen]).then(render, render);

// Web Push uchun Service Worker (QgqO0CdZ). Faqat PROD: dev'da HMR bilan
// urushmasin. Sahifa to'liq yuklangach — birinchi chizishni sekinlashtirmasin.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((error: unknown) => console.error("Service Worker ro'yxatdan o'tmadi:", error));
  });
}

// Logout'da push obunasi token bekor qilinishidan OLDIN serverdan o'chadi.
registerBeforeLogout(unsubscribePushOnLogout);
