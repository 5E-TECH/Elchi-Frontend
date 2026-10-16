import { useState } from "react";

/**
 * Tahrirlash oynasining «sessiyasi» (`/orders` dagi `useActionDialogSession` naqshi, id — satr yoki son):
 *  • har ochilishda yangi `session` — forma `key` bilan toza boshlanadi (oldingi yozilgan narsa qolmaydi);
 *  • ochiq turganda buyurtma qayta so'ralib obyekt almashsa (market tasdig'ini kutish so'rovi, saqlashdan
 *    keyingi yangilanish) — sessiya o'zgarmaydi, yozilayotgan narsa o'chmaydi;
 *  • yopilgach 200 ms yopilish harakati davomida oxirgi buyurtma ko'rsatiladi;
 *  • birinchi ochilishgacha `order` — `null`: oyna (va uning so'rov/mutatsiya hook'lari) umuman yo'q.
 */
export const useEditDialogSession = <T extends { id: string | number }>(open: boolean, order: T | null) => {
  const current = open && order ? order : null;
  const openKey = current ? String(current.id) : null;
  const [state, setState] = useState<{ session: number; openKey: string | null; last: T | null }>({
    session: 0,
    openKey,
    last: current,
  });

  // Holat render paytida yangilanadi (effektsiz): yangi ochilish — yangi sessiya; buyurtma — oxirgisi.
  if (openKey !== state.openKey || (current !== null && current !== state.last)) {
    setState((prev) => ({
      session: openKey !== null && openKey !== prev.openKey ? prev.session + 1 : prev.session,
      openKey,
      last: current ?? prev.last,
    }));
  }

  return { open: openKey !== null, order: current ?? state.last, session: state.session };
};
