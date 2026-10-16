import { useEffect, useRef, type MouseEvent, type PointerEvent, type RefObject } from "react";
import { LAYER_ATTR } from "../overlay";
import { hasOpenForeignPopup } from "../overlay/foreignPopups";

/**
 * Oyna qatlami ustida boshqa ochiq qatlam bormi: oyna ichidan ochilgan ro'yxat/kalendar (`Portal` — 1201),
 * ichki oyna yoki antd suzuvchi paneli. Xabar (`toast`) qatlami hisoblanmaydi — u bosishni to'smaydi.
 * Ustda = katta z-index, teng bo'lsa DOM'da keyin.
 */
const isCoveredByOtherLayer = (element: Element): boolean => {
  const own = element.closest<HTMLElement>(`[${LAYER_ATTR}]`);
  const root = own?.parentElement;
  if (!own || !root) return false;
  const ownZ = Number(own.style.zIndex) || 0;
  for (const layer of Array.from(root.children)) {
    if (layer === own || !(layer instanceof HTMLElement) || layer.getAttribute(LAYER_ATTR) === "toast") continue;
    const z = Number(layer.style.zIndex) || 0;
    if (z > ownZ || (z === ownZ && own.compareDocumentPosition(layer) & Node.DOCUMENT_POSITION_FOLLOWING)) return true;
  }
  return false;
};

/**
 * FON BOSILISHI — oynani faqat bosish ham, qo'yib yuborish ham fonda bo'lganda va bosish paytida oyna
 * ENG USTDA turganda yopadi.
 *
 * Oyna ichidagi ro'yxat (v2 `Select`, sana, antd `Select`/`DatePicker`) ochiq turganda fonga bosish
 * faqat ro'yxatni yopadi (Esc bilan bir xil, `layerStack`): aks holda forma bir bosishda yo'qolardi.
 * Holat `window` capture fazasida olinadi — ro'yxatning o'z «tashqariga bosish» ishlovchisi
 * (`useDismiss`, `document` capture) uni yopishidan OLDIN.
 *
 *   const backdrop = useBackdropPress(open, rootRef, () => { onClose("overlay"); return true; });
 *
 * `onPress` yopishni so'ragan bo'lsa `true` qaytaradi; `false` (masalan `closeOnOverlay={false}`) — oyna
 * qoladi va fokus oyna ichiga qaytariladi.
 *   <div ref={rootRef} onPointerDown={backdrop.onPointerDown} onClick={backdrop.onClick}>…</div>
 */
export const useBackdropPress = (
  active: boolean,
  rootRef: RefObject<HTMLElement | null>,
  onPress: () => boolean,
) => {
  const coveredRef = useRef(false);
  const pressedRef = useRef(false);
  /** Bosish paytida ochiq antd paneli bormidi. */
  const foreignRef = useRef(false);
  /** Bosish paytidagi fokus — oyna yopilmasa shu yerga qaytariladi. */
  const focusedRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!active) return;
    const handlePointerDown = () => {
      const root = rootRef.current;
      foreignRef.current = hasOpenForeignPopup();
      coveredRef.current = foreignRef.current || (root ? isCoveredByOtherLayer(root) : false);
      focusedRef.current = document.activeElement;
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [active, rootRef]);

  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      pressedRef.current = event.target === event.currentTarget && !coveredRef.current;
    },
    // Ichkarida bosib fonda qo'yib yuborish (matn belgilash) — yopilmaydi.
    onClick: (event: MouseEvent<HTMLElement>) => {
      const onBackdrop = event.target === event.currentTarget;
      const press = pressedRef.current && onBackdrop;
      pressedRef.current = false;
      if (press && onPress()) return;
      // Fonga bosildi, lekin oyna yopilmadi (ro'yxat yopildi yoki `closeOnOverlay={false}`): fon fokuslanmaydi,
      // fokus `body` ga tushib qolmasin — oyna ichida qoladi. `mousedown` ni to'xtatib bo'lmaydi: antd
      // ro'yxatlari tashqariga bosishni shu hodisa bilan sezadi. antd maydoni fokusda qayta ochiladi —
      // shuning uchun u holda fokus panelning o'ziga.
      if (!onBackdrop) return;
      const previous = focusedRef.current;
      const target =
        !foreignRef.current && previous instanceof HTMLElement && previous.isConnected && event.currentTarget.contains(previous)
          ? previous
          : event.currentTarget.querySelector<HTMLElement>("[aria-modal='true']");
      target?.focus({ preventScroll: true });
    },
  };
};
