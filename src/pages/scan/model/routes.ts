/** Skaner ekrani (kamera, `/scan`) — «Skanerga qaytish», «Yana skanerlash» va muvaffaqiyatdan keyingi qaytish. */
export const SCANNER_ROUTE = "/scan";

/** Buyurtma tafsiloti (`/orders/edit/:id`) — «Buyurtma sahifasi», «Tafsilot». */
export const orderDetailRoute = (id: string) => `/orders/edit/${encodeURIComponent(id)}`;

/** Pochta sahifasi (`/mails/:id`) — «Pochtani ochish». */
export const mailDetailRoute = (id: string) => `/mails/${encodeURIComponent(id)}`;

/** Kuryerga biriktirish (`/dispatch`): skanerlangan token `location.state.scanToken` bilan beriladi (spec G3 §3.4). */
export const DISPATCH_ROUTE = "/dispatch";
