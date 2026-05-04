import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import { clearAllSearch } from "../../features/search/model/searchSlice";
import { resetFilters } from "../../features/Select/model/FilterSlice";

/**
 * Pathname o'zgarganda global input/filter state ni tozalaydi.
 * Shu bilan oldingi sahifadagi input qiymatlari boshqa sahifaga ko'chib o'tmaydi.
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

