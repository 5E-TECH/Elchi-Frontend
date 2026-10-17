/**
 * Shaxsiy Telegram'ni botga faqat xodimlar ulaydi (kuryer, market, market operatori, menejer, registrator,
 * admin, superadmin …). Mijoz va investor uchun backend `POST /users/me/telegram/link-code` ga 403 beradi —
 * ularga karta umuman chizilmaydi.
 */
const NOT_LINKABLE_ROLES = new Set(["customer", "investor"]);

export const canLinkTelegram = (role?: string | null): boolean => {
  const normalized = typeof role === "string" ? role.trim().toLowerCase() : "";
  return normalized !== "" && !NOT_LINKABLE_ROLES.has(normalized);
};
