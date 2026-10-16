/**
 * «QABUL VA YARATISH» QOBIG'I (`/new-orders/*`) — qaysi bola sahifa qanday chiziladi.
 *
 * Qobiq (`pages/new_orders/index.tsx`) har bola route'ni o'raydi. Dizayn v2 da bola sahifalarning bir qismi
 * o'z sarlavhasini («← Qabul va yaratish» + nom) chizadi, bir qismi esa umumiy sarlavha va tablar ostida turadi.
 * Qaror sof funksiyada — route ro'yxati o'zgarsa, test shu yerda ushlaydi.
 *
 *  - `bare`   — qobiq faqat `<Outlet/>` beradi; bola o'z `PageHeader` ini (orqaga havolasi bilan) chizadi:
 *               yaratish, kiruvchi posilkalarni skanerlash, market buyurtmalari (xodim), buyurtmani tahrirlash.
 *  - `hosted` — qobiq sahifa ildizi + umumiy sarlavha («Qabul va yaratish» + «Buyurtma yaratish»), bola esa
 *               birinchi kartasini `NewOrdersTabs` bilan boshlaydi: marketlar ro'yxati, manba tanlash,
 *               market rolining o'z yangi buyurtmalari.
 *  - `legacy` — hali v2 ga ko'chirilmagan bolalar (filial paketlari, bekor qilinganlar, foydalanuvchi): sarlavha
 *               va tablar sahifa fonida (kartasiz), bola sahifa o'zgarmagan.
 */
export type NewOrdersShellMode = "bare" | "hosted" | "legacy";

/** `:marketId` bo'la olmaydigan birinchi segmentlar (shu nomdagi bola route'lar yoki eski yo'naltirishlar). */
export const NEW_ORDERS_RESERVED_SEGMENTS = [
  "create",
  "incoming",
  "branches",
  "cancelled",
  "external",
  "integrations",
  "userDetail",
] as const;

/** `/new-orders` dan keyingi segmentlar (oxiridagi `/` va bo'sh bo'laklarsiz). */
const segmentsOf = (pathname: string): string[] =>
  pathname
    .replace(/^\/?new-orders(?=\/|$)/, "")
    .split("/")
    .filter(Boolean);

export const resolveNewOrdersShellMode = (
  pathname: string,
  role: string | null | undefined,
): NewOrdersShellMode => {
  const [first, second] = segmentsOf(pathname);
  if (first === undefined) return "hosted";

  switch (first) {
    case "create":
      return "bare";
    case "incoming":
      // `/new-orders/incoming` — manba tanlash (tablar ostida); `/incoming/:marketId` — skaner, o'z sarlavhasi.
      return second === undefined ? "hosted" : "bare";
    case "branches":
    case "cancelled":
    case "userDetail":
      return "legacy";
    case "external":
    case "integrations":
      // Eski yo'llar — darhol `/integrations/...` ga yo'naltiriladi; sarlavha miltillamasin.
      return "bare";
    default:
      break;
  }

  // `/new-orders/:marketId` — market rolida bu o'zining «Yangi buyurtmalar» tabi (tablar ostida),
  // xodimda — tanlangan marketning buyurtmalari (o'z sarlavhasi). `.../edit/:orderId` — hamma uchun o'z sarlavhasi.
  if (second === undefined) return role === "market" ? "hosted" : "bare";
  return "bare";
};

/** Qobiq tablari (rolga qarab ko'rinadiganlari `resolveNewOrdersTabKeys` da). */
export type NewOrdersTabKey = "markets" | "incoming" | "branches" | "cancelled" | "marketNew" | "marketCancelled";

/**
 * Ko'rinadigan tablar — v1 qobig'idagi shartlar AYNAN (`pages/new_orders/index.tsx`, dizayn v2 gacha):
 *  - market: «Yangi buyurtmalar» va (market id ma'lum bo'lsa) «Bekor qilinganlar»;
 *  - xodim: «Marketlar» doim; «Kiruvchi posilkalar» va «Filial paketlari» — faqat superadmin/admin;
 *    «Bekor qilinganlar» — `canHandoverCancelledToMarket` (superadmin/admin va HQ registratori).
 * Natija: menejer — 1 ta tab (tablar qatori yo'q), HQ registratori — 2 ta, boshqa registrator — 1 ta.
 */
export const resolveNewOrdersTabKeys = ({
  role,
  roleId,
  canSeeCancelled,
}: {
  role: string | null | undefined;
  roleId: string | null | undefined;
  canSeeCancelled: boolean;
}): NewOrdersTabKey[] => {
  if (role === "market") return roleId ? ["marketNew", "marketCancelled"] : ["marketNew"];

  const isAdmin = role === "superadmin" || role === "admin";
  const keys: NewOrdersTabKey[] = ["markets"];
  if (isAdmin) keys.push("incoming", "branches");
  if (canSeeCancelled) keys.push("cancelled");
  return keys;
};

/** Faol tab — joriy yo'l bo'yicha (v1 dagi kabi: noma'lum bola yo'l «Marketlar» / «Yangi buyurtmalar»). */
export const resolveNewOrdersActiveTab = (pathname: string, role: string | null | undefined): NewOrdersTabKey => {
  const [first] = segmentsOf(pathname);
  const isMarket = role === "market";
  if (first === "cancelled") return isMarket ? "marketCancelled" : "cancelled";
  if (!isMarket && first === "branches") return "branches";
  if (!isMarket && first === "incoming") return "incoming";
  return isMarket ? "marketNew" : "markets";
};
