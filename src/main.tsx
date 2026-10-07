import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./app/ui/App";
import { registerBeforeLogout } from "./auth/authService";
import { unsubscribePushOnLogout } from "./features/push-notifications/lib/pushClient";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

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
