const SW_VERSION = "2026-10-06.1";

/*
 * Elchi Web Push Service Worker (QgqO0CdZ, davC9QOX).
 *
 * ATAYLAB public/ ichida: Vite uni dist/sw.js ga hash'siz nusxalaydi, scope "/"
 * bo'ladi. src/ ga ko'chirilsa /assets/sw-<hash>.js ga chiqadi va scope
 * /assets/ ga qisqarib, butun sayt uchun push ishlamaydi.
 *
 * FAQAT 3 hodisa: push, notificationclick, pushsubscriptionchange.
 * `fetch` handleri va navigatsiya/asset KESHLASH YO'Q — SW ilova fayllariga
 * tegmaydi, eski bundle'da qotib qolish xavfi yo'q.
 *
 * O'zgartirganda SW_VERSION ni oshiring: brauzer sw.js baytlari o'zgarganini
 * ko'rib yangi versiyani o'rnatadi, skipWaiting + clients.claim uni darhol
 * faollashtiradi.
 */

const DEFAULT_LINK = "/inbox";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

const parsePayload = (event) => {
  if (!event.data) return null;
  try {
    return event.data.json();
  } catch {
    return { title: event.data.text() };
  }
};

const windowClients = () =>
  self.clients.matchAll({ type: "window", includeUncontrolled: true });

self.addEventListener("push", (event) => {
  const payload = parsePayload(event);
  if (!payload || !payload.title) return;

  event.waitUntil(
    windowClients().then((clients) => {
      // Ilova ochiq tabga xabar beradi (bell badge darhol yangilansin).
      clients.forEach((client) =>
        client.postMessage({ type: "elchi:push", payload, version: SW_VERSION }),
      );

      // IKKI-XABAR TO'SIG'I: ochiq va KO'RINIB turgan tab bo'lsa tizim
      // bildirishnomasi ko'rsatilmaydi — ilova ichida yetarli.
      if (clients.some((client) => client.visibilityState === "visible")) return;

      return self.registration.showNotification(payload.title, {
        body: payload.body || undefined,
        tag: payload.tag || undefined,
        icon: "/icon-192.png",
        badge: "/favicon-48.png",
        data: { link: payload.link || DEFAULT_LINK, id: payload.id },
      });
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || DEFAULT_LINK;
  const target = new URL(link, self.location.origin).href;

  event.waitUntil(
    windowClients().then((clients) => {
      const sameOrigin = clients.find((client) => client.url.startsWith(self.location.origin));
      if (sameOrigin) {
        // navigate() faqat shu SW boshqarayotgan tabda ishlaydi — bo'lmasa yangi oyna.
        return sameOrigin
          .focus()
          .then((client) => (client || sameOrigin).navigate(target))
          .catch(() => self.clients.openWindow(target));
      }
      return self.clients.openWindow(target);
    }),
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  // Brauzer obunani almashtirdi (muddati tugadi / kalit yangilandi). SW'da
  // token yo'q, shuning uchun serverga ilova yuboradi: qayta obuna bo'lamiz
  // va ochiq tablarga aytamiz; tab yo'q bo'lsa ilova keyingi ochilishda
  // joriy obunani serverga sinxronlaydi (subscribe idempotent).
  const options = event.oldSubscription && event.oldSubscription.options;
  event.waitUntil(
    (options && options.applicationServerKey
      ? self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: options.applicationServerKey,
        })
      : Promise.resolve(null)
    )
      .catch(() => null)
      .then(() => windowClients())
      .then((clients) =>
        clients.forEach((client) => client.postMessage({ type: "elchi:push-subscription-changed" })),
      ),
  );
});
