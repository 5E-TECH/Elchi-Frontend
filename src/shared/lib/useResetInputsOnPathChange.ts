import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import { clearAllSearch } from "../model/searchSlice";
import { resetFilters } from "../model/filterSlice";

/**
 * Pathname o'zgarganda global input/filter state ni (Redux: `filter`, `search`) tozalaydi.
 * Shu bilan oldingi sahifadagi input qiymatlari boshqa sahifaga ko'chib o'tmaydi.
 *
 * Faqat Redux — URL parametrlariga tegilmaydi (iR4B6hcP): «Orqaga» da oldingi sahifa filtrlari URL'da butun.
 * ⚠️ Effekt `AppRouter` da — yangi sahifa effektlaridan KEYIN ishlaydi va ular Redux'ga yozganini o'chiradi. Shuning
 * uchun filtrni URL'dan oladigan sahifalar (/orders …) Redux'ni manba emas, faqat ko'zgu sifatida yozadi.
 */
export const useResetInputsOnPathChange = () => {
  const location = useLocation();
  const dispatch = useDispatch();
  const previousPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    const previousPathname = previousPathnameRef.current;

    if (previousPathname !== null && previousPathname !== location.pathname) {
      dispatch(clearAllSearch());
      dispatch(resetFilters());
    }

    previousPathnameRef.current = location.pathname;
  }, [dispatch, location.pathname]);
};

