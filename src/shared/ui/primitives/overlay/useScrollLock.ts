import { useEffect } from "react";

/**
 * SKROLL QULFI — modal oyna yoki pastki varaqa ochiq turganda orqadagi sahifa aylanmaydi.
 *
 * Hisoblagich bilan (ichma-ich oynalar): birinchi qulf `<html>` ga `overflow: hidden` qo'yadi,
 * oxirgisi yechilganda avvalgi inline uslublar qaytadi. Hujjat aylantirgichi (scrollbar) yo'qolganda
 * sahifa yon tomonga sakramasin — uning kengligi `padding-right` bilan to'ldiriladi.
 *
 * Shell'da (2-bosqich) sahifa `<main>` ichida aylanadi, `<html>` emas: fon ustidagi qoplama `main`
 * ning avlodi emas, shuning uchun g'ildirak/surish uni aylantirmaydi; klaviatura esa fokus qamog'i
 * bilan oyna ichida. Shu sabab `<html>` qulfi yetadi (kirish sahifasi kabi shell'siz sahifalar uchun ham).
 */
let lockCount = 0;
let saved: { overflow: string; paddingRight: string } | null = null;

const lock = () => {
  lockCount += 1;
  if (lockCount > 1) return;
  const html = document.documentElement;
  const scrollbar = window.innerWidth - html.clientWidth;
  saved = { overflow: html.style.overflow, paddingRight: html.style.paddingRight };
  html.style.overflow = "hidden";
  if (scrollbar > 0) {
    const current = Number.parseFloat(window.getComputedStyle(html).paddingRight) || 0;
    html.style.paddingRight = `${current + scrollbar}px`;
  }
  html.setAttribute("data-scroll-locked", "");
};

const unlock = () => {
  if (lockCount === 0) return;
  lockCount -= 1;
  if (lockCount > 0) return;
  const html = document.documentElement;
  html.style.overflow = saved?.overflow ?? "";
  html.style.paddingRight = saved?.paddingRight ?? "";
  html.removeAttribute("data-scroll-locked");
  saved = null;
};

/** `active` bo'lganda orqa fon skrollini qulflaydi. */
export const useScrollLock = (active: boolean) => {
  useEffect(() => {
    if (!active) return;
    lock();
    return unlock;
  }, [active]);
};
