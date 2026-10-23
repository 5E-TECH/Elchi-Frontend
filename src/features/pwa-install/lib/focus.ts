/**
 * Fokus yo'qolmasin: fokusdagi boshqaruv (taklifni yopish, qabul qilingan «O'rnatish») karta bilan birga
 * yo'qolganda fokus `<body>` ga tushib qoladi — klaviatura va ekran o'quvchi foydalanuvchisi joyini yo'qotadi.
 * Shunda fokus sahifa sarlavhasiga (`main h1`, bo'lmasa birinchi `h1`) o'tkaziladi; sarlavha fokuslanmasa —
 * `tabindex="-1"` beriladi (Tab tartibiga qo'shilmaydi).
 */
export const focusPageHeading = (): boolean => {
  if (typeof document === "undefined") return false;
  const heading = document.querySelector<HTMLElement>("main h1") ?? document.querySelector<HTMLElement>("h1");
  if (!heading) return false;
  if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
  heading.focus();
  return document.activeElement === heading;
};
