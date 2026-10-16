import { createContext, useContext } from "react";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  QATLAMLAR TARTIBI (z-index) — dizayn v2, taxta `tizim-motion` (08 «Qatlamlar tartibi»)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Ekranda nima ustida nima turishi BESHTA qiymat bilan belgilanadi. Yangi son qo'shilmaydi —
 *  har yangi element shu qatlamlardan biriga tushadi; bir qatlam ichidagi tartib DOM tartibi bilan.
 *
 *    base     0     sahifa mazmuni, kartalar, jadval
 *    sticky   10    yuqori panel, yon menyu, jadval sarlavhasi, pastki panel (shell — o'z klasslari)
 *    dropdown 1000  ro'yxat (Select), amallar menyusi, kalendar, tooltip, qidiruv natijalari
 *    overlay  1200  fon qoplamasi, dialog, tasdiqlash oynasi, pastki oyna (varaqa)
 *    toast    1300  qalqib chiquvchi xabar — bosishni to'smaydi, fokusni olmaydi
 *
 *  Oyna ichidan ochilgan ro'yxat/kalendar oyna qatlamida chiziladi (fon ostida qolmaydi):
 *  ichma-ich `Portal` ota qatlamdan bitta yuqori oladi (`LayerContext`: oyna 1200 → ro'yxat 1201).
 */
export const Z_LAYERS = {
  base: 0,
  sticky: 10,
  dropdown: 1000,
  overlay: 1200,
  toast: 1300,
} as const;

/** Portal qatlami (sahifa oqimidagi `base`/`sticky` portalga chiqmaydi). */
export type PortalLayer = "dropdown" | "overlay" | "toast";

/** Ichma-ich portal uchun ota qatlamning amaldagi z-index'i (`Portal` beradi). */
export const LayerContext = createContext<number>(Z_LAYERS.base);

/** Joriy (ota) portal qatlamining z-index'i; portal tashqarisida — 0. */
export const useParentLayerZ = () => useContext(LayerContext);

/**
 * Elementning ota-bobolari ichidagi eng katta raqamli `z-index` (pozitsiyalangan konteynerlar).
 *
 * NEGA: o'tish davrida yangi ro'yxat eski (v1) oynalar ichida ham ochiladi — ularning qatlami
 * `z-[9998]`, antd `Modal` — 1000. Ro'yxat ularning ostida qolmasligi uchun `Portal` langar
 * (`anchor`) qatlamidan bitta yuqoriga ko'tariladi. v1 oynalar ko'chirilgach bu kerak bo'lmaydi.
 */
export const getStackingZ = (element: Element | null | undefined): number => {
  let max = 0;
  let node: Element | null = element ?? null;
  while (node && node !== document.body && node !== document.documentElement) {
    const z = Number.parseInt(window.getComputedStyle(node).zIndex, 10);
    if (Number.isFinite(z) && z > max) max = z;
    node = node.parentElement;
  }
  return max;
};
