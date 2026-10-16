import { useEffect, type RefObject } from "react";
import { LAYER_ATTR, PORTAL_ROOT_ID } from "./portalRoot";

/**
 * ORQA FONNI `inert` QILISH — modal oyna ochiq turganda undan tashqaridagi hamma narsa Tab'dan,
 * sichqonchadan va ekran o'quvchidan chiqadi (WAI-ARIA dialog: `aria-modal` + haqiqiy inert).
 *
 * Hisoblagich bilan: ichma-ich oynalar (oyna ichidan tasdiqlash oynasi) bir elementni ikki marta
 * `inert` qilsa, birinchisi yopilganda atribut olinmaydi. Element biz tegishdan OLDIN `inert`
 * bo'lgan bo'lsa (boshqa kod qo'ygan) — unga umuman tegilmaydi.
 */
const counts = new Map<Element, number>();

const acquire = (element: Element): boolean => {
  const count = counts.get(element);
  if (count === undefined) {
    if (element.hasAttribute("inert")) return false;
    counts.set(element, 1);
    element.setAttribute("inert", "");
    return true;
  }
  counts.set(element, count + 1);
  return true;
};

const release = (element: Element) => {
  const count = counts.get(element);
  if (count === undefined) return;
  if (count <= 1) {
    counts.delete(element);
    element.removeAttribute("inert");
  } else {
    counts.set(element, count - 1);
  }
};

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "LINK", "TEMPLATE", "NOSCRIPT", "META"]);

/**
 * `keep` dan tashqaridagi qatlamlar:
 *   - `body` ning bevosita bolalari (`#root`, antd va eski v1 portallari), `keep` ni o'z ichiga
 *     olgani bundan mustasno;
 *   - `#ui-portal` ichidagi boshqa qatlam konteynerlari — `toast` qatlamidan tashqari (xabar
 *     oyna ochiq turganda ham ko'rinadi va o'qiladi, `tizim-motion`: «Xabar fokusni olmaydi»).
 */
const defaultTargets = (keep: Element): Element[] => {
  const targets: Element[] = [];
  for (const child of Array.from(document.body.children)) {
    if (SKIP_TAGS.has(child.tagName) || child.contains(keep)) {
      if (child.id === PORTAL_ROOT_ID) {
        for (const layer of Array.from(child.children)) {
          if (layer.contains(keep) || layer.getAttribute(LAYER_ATTR) === "toast") continue;
          targets.push(layer);
        }
      }
      continue;
    }
    if (child.id === PORTAL_ROOT_ID) {
      for (const layer of Array.from(child.children)) {
        if (layer.getAttribute(LAYER_ATTR) !== "toast") targets.push(layer);
      }
      continue;
    }
    targets.push(child);
  }
  return targets;
};

/**
 * `keep` (oyna paneli yoki uning portal konteyneri) dan tashqaridagi hammasini `inert` qiladi.
 * Qaytgan funksiya — bekor qilish (oyna yopilganda chaqiriladi).
 *
 *   const restore = inertOthers(panel);           // dialog ochildi
 *   restore();                                     // yopildi
 *   inertOthers(panel, { targets: [rootEl] });     // faqat berilgan elementlar (eski `inertAppRoot`)
 */
export const inertOthers = (keep: Element, options: { targets?: Element[] } = {}): (() => void) => {
  const targets = (options.targets ?? defaultTargets(keep)).filter((element) => !element.contains(keep));
  const touched = targets.filter(acquire);
  return () => {
    touched.forEach(release);
  };
};

/** Hook ko'rinishi: `active` bo'lganda `ref` dan tashqarini `inert` qiladi. */
export const useInertOthers = (active: boolean, ref: RefObject<Element | null>) => {
  useEffect(() => {
    const keep = ref.current;
    if (!active || !keep) return;
    return inertOthers(keep);
  }, [active, ref]);
};
