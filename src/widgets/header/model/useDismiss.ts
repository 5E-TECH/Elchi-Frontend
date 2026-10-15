import { useEffect, useRef, type RefObject } from "react";

/**
 * Ochiladigan panel (profil menyusi, qo'ng'iroqcha, qidiruv natijalari) uchun umumiy yopish qoidasi
 * (taxta `tizim-states-navigation` → 05: «Esc yoki tashqariga bosish yopadi»):
 *   - `refs` tashqarisiga bosish (sichqoncha yoki barmoq) — `onDismiss("outside")`;
 *   - Escape — `onDismiss("escape")` (chaqiruvchi fokusni tugmaga qaytaradi). Boshqa qatlam (masalan ochiq
 *     dialog) Escape'ni allaqachon ushlagan bo'lsa (`defaultPrevented`) — tegilmaydi.
 */
export type DismissReason = "outside" | "escape";

export const useDismiss = (
  open: boolean,
  refs: readonly RefObject<HTMLElement | null>[],
  onDismiss: (reason: DismissReason) => void,
  { escape = true }: { escape?: boolean } = {},
) => {
  const onDismissRef = useRef(onDismiss);
  const refsRef = useRef(refs);

  useEffect(() => {
    onDismissRef.current = onDismiss;
    refsRef.current = refs;
  });

  useEffect(() => {
    if (!open) return undefined;
    const inside = (target: EventTarget | null) =>
      target instanceof Node && refsRef.current.some((ref) => ref.current?.contains(target));

    const onPointerDown = (event: Event) => {
      if (!inside(event.target)) onDismissRef.current("outside");
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!escape || event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onDismissRef.current("escape");
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, escape]);
};
