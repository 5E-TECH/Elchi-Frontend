import { useSearchParams } from 'react-router-dom';
import { useCallback } from 'react';

/**
 * Universal hook URL query params bilan ishlash uchun
 * 
 * @example
 * const { getParam, setParam, removeParam, getAllParams } = useQueryParams();
 * 
 * // Param olish
 * const search = getParam('search');
 * 
 * // Param qo'shish/yangilash
 * setParam('search', 'test');
 * 
 * // Param o'chirish
 * removeParam('search');
 * 
 * // Barcha params olish
 * const allParams = getAllParams();
 */
export const useQueryParams = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    /**
     * Bitta param qiymatini olish
     */
    const getParam = useCallback(
        (key: string): string | null => {
            return searchParams.get(key);
        },
        [searchParams]
    );

    /**
     * Bitta param qo'shish yoki yangilash
     */
    const setParam = useCallback(
        (key: string, value: string) => {
            setSearchParams(
                (prev) => {
                    const newParams = new URLSearchParams(prev);
                    if (value) {
                        newParams.set(key, value);
                    } else {
                        newParams.delete(key);
                    }
                    return newParams;
                },
                { replace: true }
            );
        },
        [setSearchParams]
    );

    /**
     * Bir nechta paramlarni bir vaqtda qo'shish/yangilash
     */
    const setMultipleParams = useCallback(
        (params: Record<string, string>) => {
            setSearchParams(
                (prev) => {
                    const newParams = new URLSearchParams(prev);
                    Object.entries(params).forEach(([key, value]) => {
                        if (value) {
                            newParams.set(key, value);
                        } else {
                            newParams.delete(key);
                        }
                    });
                    return newParams;
                },
                { replace: true }
            );
        },
        [setSearchParams]
    );

    /**
     * Bitta param o'chirish
     */
    const removeParam = useCallback(
        (key: string) => {
            setSearchParams(
                (prev) => {
                    const newParams = new URLSearchParams(prev);
                    newParams.delete(key);
                    return newParams;
                },
                { replace: true }
            );
        },
        [setSearchParams]
    );

    /**
     * Barcha paramlarni o'chirish
     */
    const clearAllParams = useCallback(() => {
        setSearchParams(new URLSearchParams(), { replace: true });
    }, [setSearchParams]);

    /**
     * Barcha paramlarni object sifatida olish
     */
    const getAllParams = useCallback((): Record<string, string> => {
        const params: Record<string, string> = {};
        searchParams.forEach((value, key) => {
            params[key] = value;
        });
        return params;
    }, [searchParams]);

    /**
     * Param mavjudligini tekshirish
     */
    const hasParam = useCallback(
        (key: string): boolean => {
            return searchParams.has(key);
        },
        [searchParams]
    );

    return {
        getParam,
        setParam,
        setMultipleParams,
        removeParam,
        clearAllParams,
        getAllParams,
        hasParam,
    };
};
