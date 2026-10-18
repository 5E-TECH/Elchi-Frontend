import { useCallback, useEffect, useRef, useState } from "react";

/** Tanlangan (hali yuborilmagan) rasm va uning oldindan ko'rish manzili (`blob:`). */
export type PickedImage = { file: File; url: string };

/**
 * Tanlangan rasm holati: `blob:` manzil faylni tanlash paytida (hodisada) yaratiladi va almashtirilganda,
 * tozalanganda yoki komponent yo'qolganda bo'shatiladi (`revokeObjectURL`).
 */
export const usePickedImage = () => {
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const urlRef = useRef<string | null>(null);

  const pick = useCallback((file: File | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = file ? URL.createObjectURL(file) : null;
    urlRef.current = url;
    setPicked(file && url ? { file, url } : null);
  }, []);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  return [picked, pick] as const;
};
