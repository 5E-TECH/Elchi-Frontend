import { useCallback, type Ref, type RefCallback } from "react";

/** Bir nechta ref'ni bitta qiymatga ulaydi (hook tashqarisida — effekt yoki hodisa ichida). */
export const assignRefs = <T,>(value: T | null, ...refs: Array<Ref<T> | undefined | null>) => {
  for (const ref of refs) {
    if (typeof ref === "function") ref(value);
    else if (ref) (ref as { current: T | null }).current = value;
  }
};

/**
 * Bir nechta ref'ni bitta elementga ulaydi (masalan Select tugmasi: `usePopover` dagi `anchorRef` va
 * tashqaridan berilgan `ref`). Hook — render paytida ref'ni funksiyaga uzatish React Compiler lint'ida
 * (`react-hooks/refs`) xato.
 *
 *   const buttonRef = useMergedRefs(anchorRef, ref);
 *   <button ref={buttonRef} />
 */
export const useMergedRefs = <T,>(...refs: Array<Ref<T> | undefined | null>): RefCallback<T> =>
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ref'lar ro'yxati — o'zgarsa yangi callback
  useCallback((value: T | null) => assignRefs(value, ...refs), refs);
