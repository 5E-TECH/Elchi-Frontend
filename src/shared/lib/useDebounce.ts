import { useEffect, useRef, useCallback } from 'react';

/**
 * Universal debounce hook
 * 
 * @param callback - Bajarilishi kerak bo'lgan funksiya
 * @param delay - Kechikish vaqti (ms)
 * 
 * @example
 * const debouncedSearch = useDebounce((value: string) => {
 *   console.log('Searching:', value);
 * }, 1000);
 * 
 * // Input onChange da
 * onChange={(e) => debouncedSearch(e.target.value)}
 */
export const useDebounce = <T extends (...args: any[]) => void>(
    callback: T,
    delay: number
): ((...args: Parameters<T>) => void) => {
    const timeoutRef = useRef<any | null>(null);
    const callbackRef = useRef(callback);

    // Callback yangilanganda ref ni yangilash
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    // Debounced function
    const debouncedCallback = useCallback(
        (...args: Parameters<T>) => {
            // Oldingi timeout ni tozalash
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            // Yangi timeout o'rnatish
            timeoutRef.current = setTimeout(() => {
                callbackRef.current(...args);
            }, delay);
        },
        [delay]
    );

    return debouncedCallback;
};
