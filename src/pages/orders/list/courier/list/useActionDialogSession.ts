import { useEffect, useRef, useState } from "react";

/**
 * Forma «Market tasdig'i kutilmoqda» holatiga almashganda fokus «Yopish» tugmasiga o'tadi: bosilgan
 * «Sotish» / «Bekor qilish» DOM'dan olinadi va fokus `body` ga tushib qolardi (klaviatura va ekran
 * o'quvchi oynadan «chiqib ketardi»). Oyna to'g'ridan-to'g'ri shu holatda ochilsa — `Dialog` o'zi fokuslaydi.
 */
export const useApprovalStateFocus = (awaitingApproval: boolean) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const previous = useRef(awaitingApproval);
  useEffect(() => {
    if (awaitingApproval && !previous.current) closeRef.current?.focus();
    previous.current = awaitingApproval;
  }, [awaitingApproval]);
  return closeRef;
};

/**
 * Amal oynasining «sessiyasi»: har ochilishda (yoki boshqa buyurtma uchun ochilganda) yangi `key` —
 * forma holati (summa, izoh, dalil, qisman sotish) toza boshlanadi. Ro'yxat davriy yangilanib
 * buyurtma obyekti almashsa (market tasdig'ini kutish so'rovi), sessiya o'zgarmaydi — yozilgan narsa
 * o'chib ketmaydi.
 *
 * Yopilganda chaqiruvchi odatda `order={null}` beradi; oyna esa 200 ms yopilish harakati davomida
 * chiziladi — shu payt oxirgi buyurtma ko'rsatiladi (`order`).
 */
export const useActionDialogSession = <T extends { id: string }>(open: boolean, order: T | null) => {
  const openId = open && order ? order.id : null;
  const [state, setState] = useState<{ session: number; openId: string | null; last: T | null }>({
    session: 0,
    openId,
    last: order,
  });

  // Holat render paytida yangilanadi (effektsiz): yangi ochilish — yangi sessiya; buyurtma — oxirgisi.
  if (openId !== state.openId || (order !== null && order !== state.last)) {
    setState((prev) => ({
      session: openId !== null && openId !== prev.openId ? prev.session + 1 : prev.session,
      openId,
      last: order ?? prev.last,
    }));
  }

  return { open: openId !== null, order: order ?? state.last, session: state.session };
};
